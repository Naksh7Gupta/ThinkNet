import pytest

from backend.thinknet_backend_core import (
    CATALOG,
    CompiledGraph,
    GraphDef,
    NODE_CATALOG,
    NODE_IMPLEMENTATION_STATUS,
    list_nodes,
)


def test_node_catalog_discloses_execution_status_for_every_entry():
    result = list_nodes()
    assert result["count"] == len(result["nodes"])
    statuses = {"metadata-only", "partial", "implemented-and-tested"}
    assert all(node["status"] in statuses for node in result["nodes"])
    by_type = {node["type"]: node["status"] for node in result["nodes"]}
    assert by_type["Architecture"] == "implemented-and-tested"
    # Vision and cross-modal components are real executors, not metadata stubs.
    assert by_type["CrossAttention"] == "implemented-and-tested"
    assert by_type["Conv2d"] == "implemented-and-tested"
    assert by_type["PatchEmbedding"] == "implemented-and-tested"
    assert by_type["VisionTransformerBlock"] == "implemented-and-tested"
    # CPU builds have no flash kernel, so this stays honestly non-committal.
    assert by_type["FlashAttention"] == "partial"


def test_every_catalogued_type_declares_its_status_explicitly():
    # A missing entry would silently read as "metadata-only" in the GUI.
    assert {name for name, _ in NODE_CATALOG} == set(NODE_IMPLEMENTATION_STATUS)
    assert {entry["type"] for entry in CATALOG} == set(NODE_IMPLEMENTATION_STATUS)


# Quantizer runs on compiled models, not tensors, so it is intentionally excluded.
NON_TENSOR_TYPES = {"Input", "Output", "Quantizer", "Add", "Multiply", "ResidualAdd", "Concat"}
# Only configs that have no usable compiler default.
MINIMAL_CONFIGS = {
    "Reshape": {"shape": [-1]},
    "Architecture": {"architecture": "mlp", "config": {"input_dim": 4, "output_dim": 2}},
}


@pytest.mark.parametrize("node_type", sorted({name for name, _ in NODE_CATALOG} - NON_TENSOR_TYPES))
def test_every_catalogued_tensor_node_has_an_executor(node_type):
    """No catalogued building block may be dropped into a graph and fail to compile."""
    graph = GraphDef.model_validate({
        "name": f"executor-{node_type}",
        "nodes": [
            {"id": "input", "type": "Input", "config": {"shape": [4]}},
            {"id": "body", "type": node_type, "config": MINIMAL_CONFIGS.get(node_type, {})},
            {"id": "output", "type": "Output"},
        ],
        "edges": [{"source": "input", "target": "body"}, {"source": "body", "target": "output"}],
    })
    CompiledGraph(graph)  # Raises only for a genuinely missing executor.
