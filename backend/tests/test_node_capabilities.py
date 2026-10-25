from backend.thinknet_backend_core import list_nodes


def test_node_catalog_discloses_execution_status_for_every_entry():
    result = list_nodes()
    assert result["count"] == len(result["nodes"])
    statuses = {"metadata-only", "partial", "implemented-and-tested"}
    assert all(node["status"] in statuses for node in result["nodes"])
    by_type = {node["type"]: node["status"] for node in result["nodes"]}
    assert by_type["Architecture"] == "implemented-and-tested"
    assert by_type["CrossAttention"] == "metadata-only"
    assert by_type["Conv2d"] == "partial"
