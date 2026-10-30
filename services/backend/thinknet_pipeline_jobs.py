"""Background execution and experiment history for visual pipelines.

Runs are executed in worker threads; cancellation is cooperative between nodes.
Run metadata is persisted locally so completed experiments remain inspectable
after a backend restart. Active worker state itself is process-local.
"""
from __future__ import annotations

import json
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.backend.thinknet_pipelines import PipelineGraph, execute_pipeline

ROOT = Path(__file__).resolve().parents[2]
RUN_ROOT = Path(__import__("os").environ.get(
    "THINKNET_EXPERIMENT_DIR", str(ROOT / "training_output" / "experiments")
)).expanduser().resolve()
router = APIRouter(prefix="/api/v1/pipelines", tags=["pipeline-jobs"])
_EXECUTOR = ThreadPoolExecutor(max_workers=2, thread_name_prefix="thinknet-pipeline")
_JOBS: dict[str, dict[str, Any]] = {}
_CANCEL: dict[str, threading.Event] = {}
_LOCK = threading.RLock()


class PipelineJobRequest(BaseModel):
    graph: PipelineGraph
    seed: int = Field(default=42, ge=0, le=2**32 - 1)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _job_snapshot(job: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in job.items() if key not in {"cancel_event"}}


def _persist_run(run: dict[str, Any]) -> None:
    RUN_ROOT.mkdir(parents=True, exist_ok=True)
    path = RUN_ROOT / f"{run['run_id']}.json"
    path.write_text(json.dumps(run, ensure_ascii=False, indent=2, default=str), encoding="utf-8")


def _execute(job_id: str, graph: PipelineGraph, seed: int, cancel: threading.Event) -> None:
    with _LOCK:
        _JOBS[job_id].update(status="running", started_at=_now(), updated_at=_now(),
                             message="Pipeline execution started.")
    def node_update(record: dict[str, Any]) -> None:
        with _LOCK:
            job = _JOBS.get(job_id)
            if not job:
                return
            nodes = list(job.get("nodes", []))
            existing = next((i for i, item in enumerate(nodes) if item["node_id"] == record["node_id"]), None)
            if existing is None:
                nodes.append(record)
            else:
                nodes[existing] = record
            job.update(nodes=nodes, current_node=record["node_id"],
                       progress=round(100 * (sum(1 for item in nodes if item["status"] == "completed") + (0 if record["status"] != "running" else float(job.get("component_progress", 0.0)) / 100)) / max(1, job.get("total_nodes", 1)), 2),
                       message=f"{record['status'].capitalize()}: {record['node_id']}",
                       updated_at=_now())
    def progress_update(node_id: str, component_progress: float, message: str) -> None:
        with _LOCK:
            job = _JOBS.get(job_id)
            if not job:
                return
            completed = sum(1 for item in job.get("nodes", []) if item["status"] == "completed")
            total = max(1, job.get("total_nodes", 1))
            job.update(current_node=node_id,
                       component_progress=max(0.0, min(100.0, component_progress)),
                       progress=round(100 * (completed + max(0.0, min(100.0, component_progress)) / 100) / total, 2),
                       message=message, updated_at=_now())
    try:
        result = execute_pipeline(graph, seed, on_node=node_update, on_progress=progress_update, cancel_event=cancel)
        result["experiment"] = {
            "run_id": result["run_id"],
            "name": result["name"],
            "seed": seed,
            "graph": graph.model_dump(mode="json"),
            "created_at": _now(),
        }
        _persist_run(result)
        status = result["status"]
        with _LOCK:
            _JOBS[job_id].update(
                status="cancelled" if status == "cancelled" else status,
                result=result,
                run_id=result.get("run_id"),
                completed_at=_now(),
                updated_at=_now(),
                progress=100.0 if status == "completed" else _JOBS[job_id].get("progress", 0.0),
                message=("Pipeline completed." if status == "completed" else
                         "Pipeline cancelled between components." if status == "cancelled" else
                         result.get("error", "Pipeline failed.")),
            )
    except Exception as exc:
        failure = {"run_id": uuid.uuid4().hex, "name": graph.name, "status": "failed",
                   "error": str(exc), "nodes": [], "graph": graph.model_dump(mode="json"),
                   "seed": seed, "created_at": _now()}
        _persist_run(failure)
        with _LOCK:
            _JOBS[job_id].update(status="failed", error=str(exc), result=failure,
                                 completed_at=_now(), updated_at=_now(), message=str(exc))


@router.post("/jobs", status_code=202)
def start_pipeline_job(payload: PipelineJobRequest):
    # Validate before accepting work, so malformed graphs fail synchronously.
    from services.backend.thinknet_pipelines import _order
    try:
        _order(payload.graph)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    job_id = uuid.uuid4().hex[:16]
    cancel = threading.Event()
    job = {"job_id": job_id, "status": "queued", "progress": 0.0, "nodes": [],
           "current_node": None, "message": "Queued for local execution.",
           "created_at": _now(), "updated_at": _now(), "seed": payload.seed, "total_nodes": len(payload.graph.nodes)}
    with _LOCK:
        _JOBS[job_id] = job
        _CANCEL[job_id] = cancel
    _EXECUTOR.submit(_execute, job_id, payload.graph, payload.seed, cancel)
    return _job_snapshot(job)


@router.get("/jobs")
def list_pipeline_jobs():
    with _LOCK:
        active = [_job_snapshot(job) for job in _JOBS.values()]
    RUN_ROOT.mkdir(parents=True, exist_ok=True)
    known = {item.get("run_id") for item in active}
    history = []
    for path in sorted(RUN_ROOT.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            record = json.loads(path.read_text(encoding="utf-8"))
            if record.get("run_id") not in known:
                history.append({"run_id": record.get("run_id"), "name": record.get("name"),
                                "status": record.get("status"), "created_at": record.get("created_at"),
                                "seed": record.get("seed"), "run_record": path.name})
        except (OSError, ValueError):
            continue
    return {"jobs": sorted(active, key=lambda item: item["created_at"], reverse=True),
            "experiments": history[:100]}


@router.get("/jobs/{job_id}")
def get_pipeline_job(job_id: str):
    with _LOCK:
        job = _JOBS.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Pipeline job not found.")
        return _job_snapshot(job)


@router.post("/jobs/{job_id}/cancel")
def cancel_pipeline_job(job_id: str):
    with _LOCK:
        job = _JOBS.get(job_id)
        cancel = _CANCEL.get(job_id)
        if job is None or cancel is None:
            raise HTTPException(status_code=404, detail="Pipeline job not found.")
        if job["status"] not in {"queued", "running"}:
            return {"cancelled": False, "job": _job_snapshot(job)}
        cancel.set()
        job.update(status="cancelling", message="Cancellation requested; current component will finish first.",
                   updated_at=_now())
        return {"cancelled": True, "job": _job_snapshot(job)}


@router.get("/experiments")
def list_experiments():
    RUN_ROOT.mkdir(parents=True, exist_ok=True)
    records = []
    for path in sorted(RUN_ROOT.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            record = json.loads(path.read_text(encoding="utf-8"))
            records.append({"run_id": record.get("run_id"), "name": record.get("name"),
                            "status": record.get("status"), "seed": record.get("seed"),
                            "created_at": record.get("created_at"),
                            "nodes": record.get("nodes", []), "run_record": path.name})
        except (OSError, ValueError):
            continue
    return {"experiments": records[:200]}


@router.get("/experiments/{run_id}")
def get_experiment(run_id: str):
    if not run_id or any(ch not in "0123456789abcdef" for ch in run_id):
        raise HTTPException(status_code=400, detail="Invalid experiment ID.")
    path = RUN_ROOT / f"{run_id}.json"
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Experiment not found.")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise HTTPException(status_code=500, detail="Experiment record is unreadable.") from exc
