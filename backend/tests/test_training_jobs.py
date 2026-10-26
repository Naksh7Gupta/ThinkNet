from fastapi.testclient import TestClient

from backend.thinknet_backend_core import app


def test_training_job_endpoint_rejects_empty_graph():
    response = TestClient(app).post(
        "/api/v1/training/jobs",
        json={"graph": {"name": "empty", "nodes": [], "edges": []}},
    )
    assert response.status_code == 400
    assert "graph" in response.json()["detail"].lower()


def test_training_job_status_returns_404_for_unknown_job():
    response = TestClient(app).get("/api/v1/training/jobs/not-a-real-job")
    assert response.status_code == 404


def test_training_job_cancel_returns_404_for_unknown_job():
    response = TestClient(app).post("/api/v1/training/jobs/not-a-real-job/cancel")
    assert response.status_code == 404
