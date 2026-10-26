"""Local managed training jobs for supported causal-language-model graphs.

Jobs run in a background thread in the backend process. Progress is exposed
through a polling status endpoint. This local-first MVP is not durable across
backend restarts.
"""
from __future__ import annotations

import json
import threading
import time
import traceback
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import torch
import torch.nn.functional as F
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from backend.thinknet_training import TrainingSettings

router = APIRouter(tags=["training-jobs"])
ROOT = Path(__file__).resolve().parents[1]
JOB_ROOT = ROOT / "training_output" / "jobs"
_JOBS: dict[str, dict[str, Any]] = {}
_LOCK = threading.Lock()
_CANCEL: dict[str, threading.Event] = {}


class TrainingJobRequest(BaseModel):
    graph: dict[str, Any]
    training: TrainingSettings = Field(default_factory=TrainingSettings)


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _public_job(job: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in job.items() if key != "output_path"}


def _update(job_id: str, **values: Any) -> None:
    with _LOCK:
        if job_id in _JOBS:
            _JOBS[job_id].update(values)
            _JOBS[job_id]["updated_at"] = _utc_now()


def _run_job(job_id: str, graph_payload: dict[str, Any], settings: dict[str, Any]) -> None:
    cancel = _CANCEL[job_id]
    output = JOB_ROOT / job_id
    output.mkdir(parents=True, exist_ok=True)
    started = time.time()
    try:
        # Lazy imports prevent a circular import while the FastAPI app mounts this router.
        from transformers import AutoTokenizer
        from backend.thinknet_backend_core import CompiledGraph, GraphDef, validate_graph

        graph = GraphDef.model_validate(graph_payload)
        errors = validate_graph(graph)
        if errors:
            raise ValueError("Invalid graph: " + "; ".join(errors))
        if not graph.nodes:
            raise ValueError("The graph is empty.")

        dataset = Path(settings["dataset_path"]).expanduser()
        if not dataset.is_absolute():
            dataset = (ROOT / dataset).resolve()
        if not dataset.is_file():
            raise FileNotFoundError(f"Dataset file not found: {dataset}")
        text = dataset.read_text(encoding="utf-8")
        if not text.strip():
            raise ValueError("Dataset is empty.")

        torch.manual_seed(settings["seed"])
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        tokenizer = AutoTokenizer.from_pretrained(settings["tokenizer_name"])
        token_ids = tokenizer.encode(text, add_special_tokens=False)
        seq_len = settings["sequence_length"]
        if len(token_ids) <= seq_len:
            raise ValueError(
                f"Dataset has {len(token_ids)} tokens; sequence_length={seq_len} needs at least {seq_len + 1}. "
                "Add more text or reduce sequence length."
            )

        model = CompiledGraph(graph).to(device)
        parameter_count = sum(p.numel() for p in model.parameters())
        if parameter_count == 0:
            raise ValueError("The compiled graph has no trainable parameters.")
        optimizer = torch.optim.AdamW(
            model.parameters(),
            lr=settings["learning_rate"],
            weight_decay=settings["weight_decay"],
        )
        metrics_path = output / "metrics.jsonl"
        metrics_path.write_text("", encoding="utf-8")
        _update(
            job_id,
            status="running",
            phase="training",
            device=str(device),
            parameter_count=parameter_count,
            token_count=len(token_ids),
            started_at=_utc_now(),
            message="Training started.",
        )

        def sample_batch():
            starts = torch.randint(0, len(token_ids) - seq_len, (settings["batch_size"],))
            x = torch.stack([
                torch.tensor(token_ids[int(start):int(start) + seq_len], dtype=torch.long)
                for start in starts
            ]).to(device)
            y = torch.stack([
                torch.tensor(token_ids[int(start) + 1:int(start) + seq_len + 1], dtype=torch.long)
                for start in starts
            ]).to(device)
            return x, y

        model.train()
        for step in range(1, settings["max_steps"] + 1):
            if cancel.is_set():
                _update(job_id, status="cancelled", phase="cancelled", message="Training cancelled by user.")
                break
            x, y = sample_batch()
            optimizer.zero_grad(set_to_none=True)
            logits = model(x)
            if isinstance(logits, (tuple, list)):
                logits = logits[0]
            if not isinstance(logits, torch.Tensor) or logits.ndim != 3:
                raise ValueError("Causal LM training requires model output shaped [batch, sequence, vocabulary].")
            if logits.shape[:2] != y.shape:
                raise ValueError(f"Output shape {tuple(logits.shape)} is incompatible with token targets {tuple(y.shape)}.")
            if logits.shape[-1] <= int(y.max()):
                raise ValueError(
                    f"Model vocabulary ({logits.shape[-1]}) does not cover tokenizer token IDs "
                    f"(max observed ID {int(y.max())}); align model vocab_size and tokenizer."
                )
            loss = F.cross_entropy(logits.reshape(-1, logits.shape[-1]), y.reshape(-1))
            if not torch.isfinite(loss):
                raise ValueError("Training loss became NaN or infinite.")
            loss.backward()
            grad_norm = torch.nn.utils.clip_grad_norm_(model.parameters(), settings["gradient_clip_norm"])
            optimizer.step()

            loss_value = float(loss.detach().cpu())
            if step % settings["log_every_steps"] == 0 or step == 1 or step == settings["max_steps"]:
                record = {
                    "step": step,
                    "total_steps": settings["max_steps"],
                    "loss": loss_value,
                    "gradient_norm": float(grad_norm.detach().cpu()),
                    "elapsed_seconds": round(time.time() - started, 3),
                    "timestamp": _utc_now(),
                }
                with metrics_path.open("a", encoding="utf-8") as stream:
                    stream.write(json.dumps(record) + "\n")
                _update(
                    job_id,
                    step=step,
                    total_steps=settings["max_steps"],
                    progress=round(100 * step / settings["max_steps"], 2),
                    loss=loss_value,
                    elapsed_seconds=record["elapsed_seconds"],
                    message=f"Step {step}/{settings['max_steps']}",
                )

            if step % settings["save_every_steps"] == 0 or step == settings["max_steps"]:
                torch.save(
                    {
                        "model_state_dict": model.state_dict(),
                        "optimizer_state_dict": optimizer.state_dict(),
                        "step": step,
                        "graph": graph_payload,
                        "training": settings,
                    },
                    output / f"checkpoint-{step}.pt",
                )

        if cancel.is_set():
            _update(job_id, status="cancelled", phase="cancelled", message="Training cancelled by user.")
            return

        torch.save(model.state_dict(), output / "model_state_dict.pt")
        (output / "graph.json").write_text(json.dumps(graph_payload, indent=2), encoding="utf-8")
        (output / "training.json").write_text(json.dumps(settings, indent=2), encoding="utf-8")
        manifest = {
            "job_id": job_id,
            "task": "causal_language_modeling",
            "device": str(device),
            "parameter_count": parameter_count,
            "completed_at": _utc_now(),
            "files": sorted(p.name for p in output.iterdir() if p.is_file()),
        }
        (output / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        archive = output / "thinknet-training-artifacts.zip"
        with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            for path in output.iterdir():
                if path.is_file() and path != archive:
                    zf.write(path, arcname=path.name)
        _update(
            job_id,
            status="completed",
            phase="completed",
            progress=100.0,
            completed_at=_utc_now(),
            elapsed_seconds=round(time.time() - started, 3),
            message="Training completed. Download the artifact bundle to inspect the model and checkpoints.",
            artifact_available=True,
        )
    except Exception as exc:
        _update(
            job_id,
            status="failed",
            phase="failed",
            error=str(exc),
            message=str(exc),
            traceback=traceback.format_exc(limit=8),
            completed_at=_utc_now(),
        )


@router.post("/jobs")
def start_training_job(payload: TrainingJobRequest):
    if not payload.graph.get("nodes"):
        raise HTTPException(status_code=400, detail="The graph must contain at least one node.")
    job_id = uuid.uuid4().hex[:12]
    settings = payload.training.model_dump()
    job = {
        "job_id": job_id,
        "status": "queued",
        "phase": "queued",
        "step": 0,
        "total_steps": settings["max_steps"],
        "progress": 0.0,
        "loss": None,
        "message": "Queued for local execution.",
        "error": None,
        "traceback": None,
        "created_at": _utc_now(),
        "updated_at": _utc_now(),
        "elapsed_seconds": 0.0,
        "artifact_available": False,
        "output_path": str(JOB_ROOT / job_id),
    }
    with _LOCK:
        _JOBS[job_id] = job
        _CANCEL[job_id] = threading.Event()
    thread = threading.Thread(
        target=_run_job,
        args=(job_id, payload.graph, settings),
        name=f"thinknet-training-{job_id}",
        daemon=True,
    )
    thread.start()
    return {"started": True, "job": _public_job(job), "task": "causal_language_modeling"}


@router.get("/jobs")
def list_training_jobs():
    with _LOCK:
        jobs = sorted(_JOBS.values(), key=lambda item: item["created_at"], reverse=True)
        return {"jobs": [_public_job(job) for job in jobs]}


@router.get("/jobs/{job_id}")
def get_training_job(job_id: str):
    with _LOCK:
        job = _JOBS.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Training job not found.")
        return _public_job(job)


@router.post("/jobs/{job_id}/cancel")
def cancel_training_job(job_id: str):
    with _LOCK:
        job = _JOBS.get(job_id)
        event = _CANCEL.get(job_id)
        if job is None or event is None:
            raise HTTPException(status_code=404, detail="Training job not found.")
        if job["status"] not in {"queued", "running"}:
            return {"cancelled": False, "job": _public_job(job)}
        event.set()
        job["status"] = "cancelling"
        job["message"] = "Cancellation requested."
        job["updated_at"] = _utc_now()
        return {"cancelled": True, "job": _public_job(job)}


@router.get("/jobs/{job_id}/download")
def download_training_artifacts(job_id: str):
    with _LOCK:
        job = _JOBS.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Training job not found.")
        output_path = Path(job["output_path"])
        status = job["status"]
    archive = output_path / "thinknet-training-artifacts.zip"
    if status != "completed" or not archive.is_file():
        raise HTTPException(status_code=409, detail="Artifacts are available after a job completes successfully.")
    return FileResponse(archive, media_type="application/zip", filename=f"thinknet-{job_id}-artifacts.zip")
