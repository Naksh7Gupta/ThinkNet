import pytest
import torch

from services.backend.thinknet_backend_core import CompiledGraph, GraphDef, infer_shapes, validate_graph

VOCAB, D, HEADS, SEQ = 50, 16, 4, 8


def decoder_graph(num_layers=2, side_skips=False):
    skip_source_port = "skip_out" if side_skips else "output"
    nodes = [
        {"id": "input", "type": "Input", "config": {"shape": [SEQ]}},
        {"id": "tok", "type": "TokenEmbedding", "config": {"vocab_size": VOCAB, "d_model": D}},
        {"id": "pos", "type": "LearnedPositionEmbedding", "config": {"d_model": D, "max_seq_len": 16}},
    ]
    edges = [{"source": "input", "target": "tok"}, {"source": "tok", "target": "pos"}]
    prev = "pos"
    for i in range(1, num_layers + 1):
        p = f"b{i}"
        nodes += [
            {"id": f"{p}_ln1", "type": "LayerNorm", "config": {"normalized_shape": D}},
            {"id": f"{p}_attn", "type": "CausalSelfAttention", "config": {"d_model": D, "num_heads": HEADS}},
            {"id": f"{p}_add1", "type": "ResidualAdd"},
            {"id": f"{p}_ln2", "type": "LayerNorm", "config": {"normalized_shape": D}},
            {"id": f"{p}_ffn", "type": "FeedForward", "config": {"d_model": D, "hidden_features": 32}},
            {"id": f"{p}_add2", "type": "ResidualAdd"},
        ]
        edges += [
            {"source": prev, "target": f"{p}_ln1"},
            {"source": f"{p}_ln1", "target": f"{p}_attn"},
            {"source": f"{p}_attn", "target": f"{p}_add1", "target_port": "main"},
            {"source": prev, "target": f"{p}_add1", "source_port": skip_source_port, "target_port": "skip"},
            {"source": f"{p}_add1", "target": f"{p}_ln2"},
            {"source": f"{p}_ln2", "target": f"{p}_ffn"},
            {"source": f"{p}_ffn", "target": f"{p}_add2", "target_port": "main"},
            {"source": f"{p}_add1", "target": f"{p}_add2", "source_port": skip_source_port, "target_port": "skip"},
        ]
        prev = f"{p}_add2"
    nodes += [
        {"id": "final_norm", "type": "LayerNorm", "config": {"normalized_shape": D}},
        {"id": "head", "type": "LMHead", "config": {"in_features": D, "vocab_size": VOCAB}},
        {"id": "output", "type": "Output"},
    ]
    edges += [
        {"source": prev, "target": "final_norm"},
        {"source": "final_norm", "target": "head"},
        {"source": "head", "target": "output"},
    ]
    return GraphDef.model_validate({"name": "decoder", "nodes": nodes, "edges": edges})


@pytest.mark.parametrize("side_skips", [False, True])
def test_component_decoder_validates_infers_and_runs(side_skips):
    graph = decoder_graph(2, side_skips)
    assert validate_graph(graph) == []
    assert infer_shapes(graph)["outputs"]["output"] == [None, SEQ, VOCAB]
    model = CompiledGraph(graph).eval()
    logits = model(torch.randint(0, VOCAB, (3, SEQ)))
    assert logits.shape == (3, SEQ, VOCAB)


@pytest.mark.parametrize("side_skips", [False, True])
def test_component_decoder_is_causal_and_trainable(side_skips):
    model = CompiledGraph(decoder_graph(2, side_skips)).eval()
    a = torch.randint(0, VOCAB, (1, SEQ))
    b = a.clone()
    b[0, -1] = (b[0, -1] + 1) % VOCAB  # change only the last (future) token
    with torch.no_grad():
        out_a, out_b = model(a), model(b)
    torch.testing.assert_close(out_a[:, :-1], out_b[:, :-1])  # earlier positions unaffected

    model.train()
    model(a).square().mean().backward()
    assert all(p.grad is not None for p in model.parameters())