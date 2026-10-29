import pytest
import torch

from services.backend.thinknet_architectures import build_architecture, count_parameters
from services.backend.thinknet_backend_core import CompiledGraph, GraphDef, infer_shapes, validate_graph

IN_C, BASE, CLASSES, IMG = 3, 8, 10, 32
# Mirrors ConvNetClassifier: four Conv-BN-GELU stages, pooling after the 2nd and 4th.
STAGES = [("s1", IN_C, BASE, False), ("s2", BASE, BASE, True),
          ("s3", BASE, BASE * 2, False), ("s4", BASE * 2, BASE * 2, True)]


def cnn_graph(pooling="adaptive"):
    nodes = [{"id": "input", "type": "Input", "config": {"shape": [IN_C, IMG, IMG]}}]
    edges = []
    previous = "input"
    for prefix, in_channels, out_channels, pooled in STAGES:
        stage = [
            {"id": f"{prefix}_conv", "type": "Conv2d", "config": {
                "in_channels": in_channels, "out_channels": out_channels,
                "kernel_size": 3, "stride": 1, "padding": 1, "bias": False}},
            {"id": f"{prefix}_bn", "type": "BatchNorm2d", "config": {"num_features": out_channels}},
            {"id": f"{prefix}_act", "type": "GELU"},
        ]
        if pooled:
            stage.append({"id": f"{prefix}_pool", "type": "MaxPool2d",
                          "config": {"kernel_size": 2, "stride": 2}})
        for node in stage:
            edges.append({"source": previous, "target": node["id"]})
            nodes.append(node)
            previous = node["id"]

    if pooling == "global":
        tail = [{"id": "pool", "type": "GlobalAveragePool"}]
    else:
        tail = [
            {"id": "pool", "type": "AdaptiveAvgPool2d", "config": {"output_size": 1}},
            {"id": "flatten", "type": "Flatten", "config": {"start_dim": 1, "end_dim": -1}},
        ]
    tail.append({"id": "drop", "type": "Dropout", "config": {"p": 0.1}})
    tail.append({"id": "head", "type": "Linear",
                 "config": {"in_features": BASE * 2, "out_features": CLASSES}})
    tail.append({"id": "output", "type": "Output"})
    for node in tail:
        edges.append({"source": previous, "target": node["id"]})
        nodes.append(node)
        previous = node["id"]
    return GraphDef.model_validate({"name": "cnn-from-nodes", "nodes": nodes, "edges": edges})


@pytest.mark.parametrize("pooling", ["adaptive", "global"])
def test_cnn_from_nodes_validates_infers_and_runs(pooling):
    graph = cnn_graph(pooling)
    assert validate_graph(graph) == []
    assert infer_shapes(graph)["outputs"]["output"] == [None, CLASSES]
    model = CompiledGraph(graph).eval()
    with torch.no_grad():
        logits = model(torch.randn(2, IN_C, IMG, IMG))
    assert logits.shape == (2, CLASSES)
    assert torch.isfinite(logits).all()


@pytest.mark.parametrize("pooling", ["adaptive", "global"])
def test_cnn_from_nodes_is_trainable(pooling):
    model = CompiledGraph(cnn_graph(pooling))
    model.train()
    model(torch.randn(2, IN_C, IMG, IMG)).square().mean().backward()
    assert all(parameter.grad is not None for parameter in model.parameters())


def test_cnn_component_graph_matches_the_preset_recipe():
    """Assembling primitives must reproduce the monolithic cnn_classifier exactly."""
    assembled = CompiledGraph(cnn_graph("adaptive"))
    preset = build_architecture("cnn_classifier", {
        "in_channels": IN_C, "num_classes": CLASSES, "base_channels": BASE, "dropout": 0.1})
    assert count_parameters(assembled) == count_parameters(preset)


def test_groupnorm_and_avgpool_stages_execute():
    nodes = [
        {"id": "input", "type": "Input", "config": {"shape": [3, 16, 16]}},
        {"id": "conv", "type": "Conv2d", "config": {
            "in_channels": 3, "out_channels": 8, "kernel_size": 3, "padding": 1}},
        {"id": "norm", "type": "GroupNorm", "config": {"num_groups": 4, "num_channels": 8}},
        {"id": "act", "type": "SiLU"},
        {"id": "pool", "type": "AvgPool2d", "config": {"kernel_size": 2, "stride": 2}},
        {"id": "gap", "type": "GlobalAveragePool"},
        {"id": "head", "type": "Linear", "config": {"in_features": 8, "out_features": 4}},
        {"id": "output", "type": "Output"},
    ]
    edges = [{"source": a["id"], "target": b["id"]} for a, b in zip(nodes, nodes[1:])]
    graph = GraphDef.model_validate({"name": "cnn-variants", "nodes": nodes, "edges": edges})
    assert validate_graph(graph) == []
    assert infer_shapes(graph)["outputs"]["output"] == [None, 4]
    with torch.no_grad():
        logits = CompiledGraph(graph).eval()(torch.randn(3, 3, 16, 16))
    assert logits.shape == (3, 4)


def test_cnn_rejects_mismatched_channels_at_runtime():
    nodes = [
        {"id": "input", "type": "Input", "config": {"shape": [3, 8, 8]}},
        {"id": "conv", "type": "Conv2d", "config": {"in_channels": 4, "out_channels": 2, "kernel_size": 1}},
        {"id": "output", "type": "Output"},
    ]
    edges = [{"source": "input", "target": "conv"}, {"source": "conv", "target": "output"}]
    graph = GraphDef.model_validate({"name": "bad-channels", "nodes": nodes, "edges": edges})
    assert validate_graph(graph) == []
    with pytest.raises(RuntimeError, match="expected input.*4 channels"):
        CompiledGraph(graph).eval()(torch.randn(1, 3, 8, 8))
