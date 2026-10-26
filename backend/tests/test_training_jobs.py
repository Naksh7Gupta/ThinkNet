import json
import threading
import time

import pytest
from fastapi.testclient import TestClient

import backend.thinknet_training_jobs as training_jobs
from backend.thinknet_backend_core import app


def edge(source, target, source_port="main", target_port="input"):
    return {"source": source, "target": target, "source_port": source_port, "target_port": target_port}


def decoder_graph(vocab=256, seq=32, max_seq=128):
    nodes = [
        {"id": "input", "type": "Input", "config": {"shape": [seq]}},
        {"id": "token_embedding", "type": "TokenEmbedding", "config": {"vocab_size": vocab, "d_model": 32}},
        {"id": "position_embedding", "type": "LearnedPositionEmbedding", "config": {"d_model": 32, "max_seq_len": max_seq}},
        {"id": "ln", "type": "LayerNorm", "config": {"normalized_shape": 32}},
        {"id": "lm_head", "type": "LMHead", "config": {"in_features": 32, "vocab_size": vocab, "bias": False}},
        {"id": "output", "type": "Output", "config": {}},
    ]
    edges = [
        edge("input", "token_embedding"), edge("token_embedding", "position_embedding"),
        edge("position_embedding", "ln"), edge("ln", "lm_head"), edge("lm_head", "output"),
    ]
    return {"name": "decoder_minimal", "nodes": nodes, "edges": edges}


class FakeTokenizer:
    """Offline stand-in for a Hugging Face tokenizer with IDs far above the graph vocabulary."""

    vocab_size = 5000

    def __len__(self):
        return self.vocab_size

    def encode(self, text, add_special_tokens=False):
        token_ids = [abs(hash(word)) % self.vocab_size for word in text.split()]
        return token_ids or [1, 2, 3]

    def save_pretrained(self, directory):
        directory.mkdir(parents=True, exist_ok=True)
        (directory / "tokenizer.json").write_text('{"fake": true}', encoding="utf-8")


@pytest.fixture
def fake_tokenizer(monkeypatch):
    monkeypatch.setattr(training_jobs, "_load_tokenizer", lambda name: FakeTokenizer())


@pytest.fixture
def job_root(tmp_path, monkeypatch):
    root = tmp_path / "jobs"
    monkeypatch.setattr(training_jobs, "JOB_ROOT", root)
    return root


def register_job(job_id, settings):
    training_jobs._JOBS[job_id] = {
        "job_id": job_id, "status": "queued", "phase": "queued", "step": 0,
        "total_steps": settings["max_steps"], "progress": 0.0, "loss": None,
        "message": "", "error": None, "traceback": None, "elapsed_seconds": 0.0,
        "vocabulary_size": None, "graph_adjustments": [], "artifact_available": False,
        "created_at": training_jobs._utc_now(), "updated_at": training_jobs._utc_now(),
        "output_path": str(training_jobs.JOB_ROOT / job_id),
    }
    training_jobs._CANCEL[job_id] = threading.Event()
    return training_jobs._CANCEL[job_id]


def run_job_synchronously(graph, settings, job_id="testjob00001"):
    """Runs the runner on the current thread so results never depend on scheduler timing."""
    register_job(job_id, settings)
    try:
        training_jobs._run_job(job_id, graph, settings)
        return dict(training_jobs._JOBS[job_id])
    finally:
        training_jobs._JOBS.pop(job_id, None)
        training_jobs._CANCEL.pop(job_id, None)


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


def test_align_graph_raises_vocabulary_input_shape_and_position_limit():
    graph = decoder_graph(vocab=8, seq=4, max_seq=8)
    aligned, adjustments = training_jobs.align_graph_for_causal_lm(
        graph, vocab_size=512, sequence_length=16
    )
    configs = {node["id"]: node["config"] for node in aligned["nodes"]}
    assert configs["token_embedding"]["vocab_size"] == 512
    assert configs["lm_head"]["vocab_size"] == 512
    assert configs["input"]["shape"] == [16]
    assert configs["position_embedding"]["max_seq_len"] == 16
    assert len(adjustments) == 4
    # Alignment is job-local: the caller's canvas graph must stay untouched.
    assert graph["nodes"][1]["config"]["vocab_size"] == 8
    assert graph["nodes"][0]["config"]["shape"] == [4]


def test_align_graph_rejects_graphs_without_an_lm_head():
    graph = decoder_graph()
    graph["nodes"] = [node for node in graph["nodes"] if node["type"] != "LMHead"]
    with pytest.raises(ValueError, match="language-model head"):
        training_jobs.align_graph_for_causal_lm(graph, vocab_size=512, sequence_length=16)


def test_align_graph_rejects_graphs_without_a_token_embedding():
    graph = decoder_graph()
    graph["nodes"] = [node for node in graph["nodes"] if node["type"] != "TokenEmbedding"]
    with pytest.raises(ValueError, match="token embedding"):
        training_jobs.align_graph_for_causal_lm(graph, vocab_size=512, sequence_length=16)


def test_graph_vocab_reads_the_widest_declared_vocabulary():
    assert training_jobs._graph_vocab(decoder_graph(vocab=77)) == 77
    assert training_jobs._graph_vocab({"nodes": [{"id": "x", "type": "Input", "config": {}}]}) is None


def test_preflight_reports_a_missing_dataset(fake_tokenizer):
    response = TestClient(app).post(
        "/api/v1/training/jobs/preflight",
        json={"graph": decoder_graph(), "training": {"dataset_path": "backend/data/definitely-missing.txt"}},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["ready"] is False
    assert "not found" in body["errors"][0]


def test_preflight_reports_the_alignment_it_would_apply(fake_tokenizer):
    body = TestClient(app).post(
        "/api/v1/training/jobs/preflight",
        json={"graph": decoder_graph(), "training": {"sequence_length": 8}},
    ).json()
    assert body["ready"] is True, body
    assert body["model_vocab_size"] == 256
    assert body["vocabulary_size"] == FakeTokenizer.vocab_size
    assert body["parameter_count"] > 0
    assert any("vocab_size" in adjustment for adjustment in body["graph_adjustments"])


def test_run_job_trains_and_saves_every_artifact(fake_tokenizer, job_root):
    settings = training_jobs.TrainingSettings(
        sequence_length=8, batch_size=2, max_steps=3, log_every_steps=1, save_every_steps=1
    ).model_dump()
    job = run_job_synchronously(decoder_graph(seq=8), settings)

    assert job["status"] == "completed", job["error"]
    assert job["artifact_available"] is True
    assert job["vocabulary_size"] == FakeTokenizer.vocab_size
    assert job["graph_adjustments"]

    output = job_root / job["job_id"]
    for name in ("model_state_dict.pt", "checkpoint-last.pt", "graph.json", "training.json",
                 "metrics.jsonl", "tokenizer/tokenizer.json", "thinknet-training-artifacts.zip"):
        assert (output / name).is_file(), name

    manifest = json.loads((output / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["status"] == "completed"
    assert manifest["steps_completed"] == 3
    assert manifest["vocabulary_size"] == FakeTokenizer.vocab_size
    assert len((output / "metrics.jsonl").read_text(encoding="utf-8").strip().splitlines()) == 3
    # The exported graph is the aligned one, so reloading it can never hit the old vocabulary.
    exported = json.loads((output / "graph.json").read_text(encoding="utf-8"))
    embedding = next(node for node in exported["nodes"] if node["type"] == "TokenEmbedding")
    assert embedding["config"]["vocab_size"] == FakeTokenizer.vocab_size


def test_step_checkpoints_are_rotated(fake_tokenizer, job_root):
    settings = training_jobs.TrainingSettings(
        sequence_length=8, batch_size=2, max_steps=9, log_every_steps=5, save_every_steps=1
    ).model_dump()
    job = run_job_synchronously(decoder_graph(seq=8), settings, job_id="testjob00002")

    assert job["status"] == "completed", job["error"]
    kept = training_jobs._step_checkpoint_files(job_root / job["job_id"])
    assert [path.stem for path in kept] == ["checkpoint-7", "checkpoint-8", "checkpoint-9"]


def test_download_is_allowed_for_a_cancelled_run(fake_tokenizer, job_root):
    settings = training_jobs.TrainingSettings(
        sequence_length=8, batch_size=2, max_steps=100000, log_every_steps=1, save_every_steps=1
    ).model_dump()
    job_id = "testjob00003"
    cancel = register_job(job_id, settings)
    worker = threading.Thread(target=training_jobs._run_job, args=(job_id, decoder_graph(seq=8), settings))
    worker.start()
    deadline = time.time() + 60
    while time.time() < deadline and training_jobs._JOBS[job_id]["step"] < 1:
        time.sleep(0.05)
    cancel.set()
    worker.join(timeout=120)
    job = training_jobs._JOBS.pop(job_id)
    training_jobs._CANCEL.pop(job_id, None)

    assert job["status"] == "cancelled", job
    assert 1 <= job["step"] < settings["max_steps"]
    assert job["artifact_available"] is True
    archive = job_root / job_id / "thinknet-training-artifacts.zip"
    assert archive.is_file()
    manifest = json.loads((job_root / job_id / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["steps_completed"] == job["step"]
