import pytest
import torch

from services.backend.thinknet_architectures import build_architecture, count_parameters
from services.backend.thinknet_backend_core import CompiledGraph, GraphDef, infer_shapes, validate_graph

IMG, PATCH, IN_C, D, HEADS, BLOCKS, CLASSES = 16, 4, 3, 16, 4, 2, 10
TOKENS = (IMG // PATCH) ** 2 + 1  # patches plus the [CLS] token


def vit_graph(num_blocks=BLOCKS, pooling="cls"):
    """A ViT wired token-by-token: no Architecture node anywhere in this graph."""
    nodes = [
        {"id": "input", "type": "Input", "config": {"shape": [IN_C, IMG, IMG]}},
        {"id": "patch", "type": "PatchEmbedding",
         "config": {"in_channels": IN_C, "d_model": D, "patch_size": PATCH}},
        {"id": "cls", "type": "ClassToken", "config": {"d_model": D, "num_tokens": 1}},
        {"id": "pos", "type": "LearnedPositionEmbedding", "config": {"d_model": D, "max_seq_len": TOKENS}},
    ]
    edges = [{"source": "input", "target": "patch"}, {"source": "patch", "target": "cls"},
             {"source": "cls", "target": "pos"}]
    previous = "pos"
    for index in range(1, num_blocks + 1):
        prefix = f"b{index}"
        nodes += [
            {"id": f"{prefix}_ln1", "type": "LayerNorm", "config": {"normalized_shape": D}},
            {"id": f"{prefix}_attn", "type": "MultiHeadAttention",
             "config": {"d_model": D, "num_heads": HEADS}},
            {"id": f"{prefix}_add1", "type": "ResidualAdd"},
            {"id": f"{prefix}_ln2", "type": "LayerNorm", "config": {"normalized_shape": D}},
            {"id": f"{prefix}_ffn", "type": "MLP", "config": {"d_model": D, "hidden_features": 4 * D}},
            {"id": f"{prefix}_add2", "type": "ResidualAdd"},
        ]
        edges += [
            {"source": previous, "target": f"{prefix}_ln1"},
            {"source": f"{prefix}_ln1", "target": f"{prefix}_attn"},
            {"source": f"{prefix}_attn", "target": f"{prefix}_add1", "target_port": "main"},
            {"source": previous, "target": f"{prefix}_add1", "target_port": "skip"},
            {"source": f"{prefix}_add1", "target": f"{prefix}_ln2"},
            {"source": f"{prefix}_ln2", "target": f"{prefix}_ffn"},
            {"source": f"{prefix}_ffn", "target": f"{prefix}_add2", "target_port": "main"},
            {"source": f"{prefix}_add1", "target": f"{prefix}_add2", "target_port": "skip"},
        ]
        previous = f"{prefix}_add2"

    tail = [{"id": "final_norm", "type": "LayerNorm", "config": {"normalized_shape": D}}]
    if pooling == "cls":
        tail.append({"id": "readout", "type": "SelectToken", "config": {"index": 0, "dim": -2}})
    else:
        tail.append({"id": "readout", "type": "MeanPool", "config": {"dim": -2}})
    tail.append({"id": "head", "type": "Linear", "config": {"in_features": D, "out_features": CLASSES}})
    tail.append({"id": "output", "type": "Output"})
    for node in tail:
        edges.append({"source": previous, "target": node["id"]})
        nodes.append(node)
        previous = node["id"]
    return GraphDef.model_validate({"name": "vit-from-nodes", "nodes": nodes, "edges": edges})


@pytest.mark.parametrize("pooling", ["cls", "mean"])
def test_vit_from_nodes_validates_infers_and_runs(pooling):
    graph = vit_graph(pooling=pooling)
    assert validate_graph(graph) == []
    assert infer_shapes(graph)["outputs"]["output"] == [None, CLASSES]
    model = CompiledGraph(graph).eval()
    model.shape_log = {}
    with torch.no_grad():
        logits = model(torch.randn(2, IN_C, IMG, IMG))
    assert logits.shape == (2, CLASSES)
    assert torch.isfinite(logits).all()
    assert model.shape_log["patch"] == [2, TOKENS - 1, D]
    assert model.shape_log["cls"] == [2, TOKENS, D]
    assert model.shape_log["readout"] == [2, D]


@pytest.mark.parametrize("pooling", ["cls", "mean"])
def test_vit_from_nodes_is_trainable(pooling):
    model = CompiledGraph(vit_graph(pooling=pooling))
    model.train()
    model(torch.randn(2, IN_C, IMG, IMG)).square().mean().backward()
    assert all(parameter.grad is not None for parameter in model.parameters())


def test_vit_component_graph_matches_the_preset_recipe():
    """The hand-wired primitives must reproduce the monolithic vit_classifier."""
    assembled = CompiledGraph(vit_graph())
    preset = build_architecture("vit_classifier", {
        "image_size": IMG, "patch_size": PATCH, "in_channels": IN_C, "num_classes": CLASSES,
        "d_model": D, "num_layers": BLOCKS, "num_heads": HEADS, "mlp_ratio": 4, "dropout": 0.0,
    })
    assert count_parameters(assembled) == count_parameters(preset)


def test_vit_cls_readout_differs_from_mean_readout():
    torch.manual_seed(0)
    images = torch.randn(1, IN_C, IMG, IMG)
    outputs = [CompiledGraph(vit_graph(pooling=pooling)).eval()(images) for pooling in ("cls", "mean")]
    assert not torch.allclose(outputs[0], outputs[1])


def test_encoder_stack_node_builds_the_same_model_in_one_block():
    """TransformerEncoder is the compact alternative to unrolling the blocks by hand."""
    nodes = [
        {"id": "input", "type": "Input", "config": {"shape": [IN_C, IMG, IMG]}},
        {"id": "patch", "type": "PatchEmbedding",
         "config": {"in_channels": IN_C, "d_model": D, "patch_size": PATCH}},
        {"id": "cls", "type": "ClassToken", "config": {"d_model": D}},
        {"id": "encoder", "type": "TransformerEncoder", "config": {
            "d_model": D, "num_layers": BLOCKS, "num_heads": HEADS,
            "mlp_ratio": 4, "norm_first": True, "final_norm": True}},
        {"id": "readout", "type": "SelectToken", "config": {"index": 0, "dim": -2}},
        {"id": "head", "type": "Linear", "config": {"in_features": D, "out_features": CLASSES}},
        {"id": "output", "type": "Output"},
    ]
    edges = [{"source": a["id"], "target": b["id"]} for a, b in zip(nodes, nodes[1:])]
    graph = GraphDef.model_validate({"name": "vit-encoded", "nodes": nodes, "edges": edges})
    assert validate_graph(graph) == []
    assert infer_shapes(graph)["outputs"]["output"] == [None, CLASSES]
    with torch.no_grad():
        logits = CompiledGraph(graph).eval()(torch.randn(3, IN_C, IMG, IMG))
    assert logits.shape == (3, CLASSES)


def test_vit_block_node_with_rope_and_layer_scale():
    """Post-norm ViT blocks plus rotary positions and LayerScale run as drawn."""
    nodes = [
        {"id": "input", "type": "Input", "config": {"shape": [IMG // PATCH, IMG // PATCH, D]}},
        {"id": "reshape", "type": "Reshape", "config": {"shape": [-1, D]}},
        {"id": "rope", "type": "RotaryPositionEmbedding", "config": {"d_model": D, "num_heads": HEADS}},
        {"id": "block", "type": "VisionTransformerBlock",
         "config": {"d_model": D, "num_heads": HEADS, "mlp_ratio": 2}},
        {"id": "scale", "type": "LayerScale", "config": {"d_model": D, "init_value": 1.0}},
        {"id": "head", "type": "Linear", "config": {"in_features": D, "out_features": CLASSES}},
        {"id": "output", "type": "Output"},
    ]
    edges = [{"source": a["id"], "target": b["id"]} for a, b in zip(nodes, nodes[1:])]
    graph = GraphDef.model_validate({"name": "vit-block-stack", "nodes": nodes, "edges": edges})
    assert validate_graph(graph) == []
    model = CompiledGraph(graph).eval()
    model.shape_log = {}
    with torch.no_grad():
        logits = model(torch.randn(2, IMG // PATCH, IMG // PATCH, D))
    assert logits.shape == (2, TOKENS - 1, CLASSES)
    assert model.shape_log["block"] == [2, TOKENS - 1, D]
    assert torch.isfinite(logits).all()
