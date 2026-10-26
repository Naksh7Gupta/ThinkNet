"""Every attention variant in the catalogue must be a real, droppable block."""
import pytest
import torch

from backend.thinknet_backend_core import CompiledGraph, GraphDef, infer_shapes, validate_graph

VOCAB, D, HEADS, SEQ = 40, 16, 4, 6

SELF_ATTENTION_NODES = [
    "MultiHeadAttention", "CausalSelfAttention", "GroupedQueryAttention", "MultiQueryAttention",
    "ScaledDotProductAttention", "FlashAttention", "LinearAttention", "AdditiveAttention",
]
CAUSAL_NODES = [
    "CausalSelfAttention", "GroupedQueryAttention", "MultiQueryAttention", "FlashAttention",
    "LinearAttention", "AdditiveAttention",
]


def attention_graph(node_type, **config):
    nodes = [
        {"id": "input", "type": "Input", "config": {"shape": [SEQ]}},
        {"id": "tok", "type": "TokenEmbedding", "config": {"vocab_size": VOCAB, "d_model": D}},
        {"id": "attn", "type": node_type, "config": {"d_model": D, "num_heads": HEADS}},
        {"id": "output", "type": "Output"},
    ]
    nodes[2]["config"].update(config)
    edges = [{"source": "input", "target": "tok"}, {"source": "tok", "target": "attn"},
             {"source": "attn", "target": "output"}]
    return GraphDef.model_validate({"name": "attention-graph", "nodes": nodes, "edges": edges})


@pytest.mark.parametrize("node_type", SELF_ATTENTION_NODES)
def test_each_attention_node_keeps_token_shape_and_stays_finite(node_type):
    graph = attention_graph(node_type)
    assert validate_graph(graph) == []
    assert infer_shapes(graph)["outputs"]["output"] == [None, SEQ, D]
    with torch.no_grad():
        output = CompiledGraph(graph).eval()(torch.randint(0, VOCAB, (3, SEQ)))
    assert output.shape == (3, SEQ, D)
    assert torch.isfinite(output).all()


@pytest.mark.parametrize("node_type", SELF_ATTENTION_NODES)
def test_each_attention_node_is_trainable(node_type):
    model = CompiledGraph(attention_graph(node_type))
    model.train()
    model(torch.randint(0, VOCAB, (2, SEQ))).square().mean().backward()
    assert all(parameter.grad is not None for parameter in model.parameters())


@pytest.mark.parametrize("node_type", CAUSAL_NODES)
def test_causal_variants_do_not_leak_future_tokens(node_type):
    model = CompiledGraph(attention_graph(node_type, causal=True)).eval()
    tokens = torch.randint(0, VOCAB, (1, SEQ))
    shifted = tokens.clone()
    shifted[0, -1] = (shifted[0, -1] + 1) % VOCAB
    with torch.no_grad():
        before, after = model(tokens), model(shifted)
    torch.testing.assert_close(before[:, :-1], after[:, :-1])


@pytest.mark.parametrize("node_type", ["MultiHeadAttention", "ScaledDotProductAttention"])
def test_non_causal_attention_does_change_with_the_future(node_type):
    model = CompiledGraph(attention_graph(node_type)).eval()
    tokens = torch.randint(0, VOCAB, (1, SEQ))
    shifted = tokens.clone()
    shifted[0, -1] = (shifted[0, -1] + 1) % VOCAB
    with torch.no_grad():
        before, after = model(tokens), model(shifted)
    assert not torch.allclose(before[:, 0], after[:, 0])


def test_grouped_query_attention_fewer_key_value_heads():
    full = CompiledGraph(attention_graph("GroupedQueryAttention", num_kv_heads=4)).eval()
    shared = CompiledGraph(attention_graph("GroupedQueryAttention", num_kv_heads=1)).eval()
    key_width = sum(parameter.numel() for name, parameter in shared.named_parameters() if ".key." in name)
    assert key_width < sum(parameter.numel() for name, parameter in full.named_parameters() if ".key." in name)


def cross_attention_graph(context_port="input_b"):
    nodes = [
        {"id": "query", "type": "Input", "config": {"shape": [SEQ]}},
        {"id": "source", "type": "Input", "config": {"shape": [SEQ]}},
        {"id": "query_tokens", "type": "TokenEmbedding", "config": {"vocab_size": VOCAB, "d_model": D}},
        {"id": "context_tokens", "type": "TokenEmbedding", "config": {"vocab_size": VOCAB, "d_model": D}},
        {"id": "cross", "type": "CrossAttention", "config": {"d_model": D, "num_heads": HEADS}},
        {"id": "add", "type": "ResidualAdd"},
        {"id": "head", "type": "Linear", "config": {"in_features": D, "out_features": VOCAB}},
        {"id": "output", "type": "Output"},
    ]
    edges = [
        {"source": "query", "target": "query_tokens"},
        {"source": "source", "target": "context_tokens"},
        {"source": "query_tokens", "target": "cross"},
        {"source": "context_tokens", "target": "cross", "target_port": context_port},
        {"source": "cross", "target": "add", "target_port": "main"},
        {"source": "query_tokens", "target": "add", "target_port": "skip"},
        {"source": "add", "target": "head"},
        {"source": "head", "target": "output"},
    ]
    return GraphDef.model_validate({"name": "cross-attention", "nodes": nodes, "edges": edges})


@pytest.mark.parametrize("context_port", ["input_b", "context"])
def test_cross_attention_reads_query_and_context_ports(context_port):
    graph = cross_attention_graph(context_port)
    assert validate_graph(graph) == []
    model = CompiledGraph(graph).eval()
    query = torch.randint(0, VOCAB, (2, SEQ))
    context = torch.randint(0, VOCAB, (2, SEQ))
    with torch.no_grad():
        output = model(query, extra_inputs={"source": context})
    assert output.shape == (2, SEQ, VOCAB)


def test_cross_attention_reads_a_context_of_different_length():
    graph = cross_attention_graph()
    for node in graph.nodes:
        if node.id == "source":
            node.config["shape"] = [SEQ * 2]
    model = CompiledGraph(graph).eval()
    context = torch.randint(0, VOCAB, (2, SEQ * 2))
    with torch.no_grad():
        output = model(torch.randint(0, VOCAB, (2, SEQ)), extra_inputs={"source": context})
    assert output.shape == (2, SEQ, VOCAB)


def test_cross_attention_requires_a_context_edge():
    graph = cross_attention_graph()
    graph.edges = [e for e in graph.edges if not (e.target == "cross" and e.target_port != "input")]
    assert any("input_b" in error for error in validate_graph(graph))


@pytest.mark.parametrize("node_type", ["LinearAttention", "FlashAttention"])
def test_undivisible_attention_width_is_a_graph_error(node_type):
    errors = validate_graph(attention_graph(node_type, num_heads=3))
    assert errors == ["Node 'attn': d_model must be divisible by num_heads."]
