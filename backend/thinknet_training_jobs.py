"""Local managed training jobs for supported causal-language-model graphs.

Jobs run in a background thread in the backend process. Progress is exposed
through a polling status endpoint. This local-first MVP is not durable across
backend restarts.
"""
from __future__ import annotations

import copy
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
_TOKENIZERS: dict[str, Any] = {}


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


EMBEDDING_KEY = {"TokenEmbedding": "vocab_size", "Embedding": "num_embeddings"}
VOCAB_KEYS = ("num_embeddings", "vocab_size")
ARCH_VOCAB_KEYS = ("vocab_size", "vocab")
# Periodic checkpoints are weights-only and rotated: a long run must not fill the disk.
KEEP_STEP_CHECKPOINTS = 3


def _raise_if_smaller(cfg: dict[str, Any], keys: tuple[str, ...], required: int, label: str,
                      node_id: str, adjustments: list[str]) -> None:
    """Grow the first vocabulary/length key present in ``cfg`` (or the first key) to ``required``."""
    key = next((k for k in keys if k in cfg), keys[0])
    current = int(cfg.get(key, 0) or 0)
    if current < required:
        cfg[key] = required
        adjustments.append(f"{label} '{node_id}': {key} {current} -> {required}.")


def align_graph_for_causal_lm(graph_payload: dict[str, Any], *, vocab_size: int,
                              sequence_length: int) -> tuple[dict[str, Any], list[str]]:
    """Return a job-local copy of the graph that can consume this tokenizer and sequence length.

    Canvas graphs are usually sketched with a small placeholder vocabulary, so the runner
    raises embedding/LM-head widths and position limits to cover the real token IDs instead of
    failing inside ``nn.Embedding``. The canvas graph is never mutated; the adjusted graph is
    what gets compiled, checkpointed and exported with the run.
    """
    payload = copy.deepcopy(graph_payload)
    adjustments: list[str] = []
    nodes = payload.get("nodes") or []
    has_token_input = has_head = False
    for node in nodes:
        if not isinstance(node, dict):
            continue
        node_id = str(node.get("id", "?"))
        cfg = node.get("config")
        if not isinstance(cfg, dict):
            cfg = {}
            node["config"] = cfg
        node_type = node.get("type")
        if node_type == "Input":
            shape = cfg.get("shape")
            if (isinstance(shape, list) and len(shape) == 1 and isinstance(shape[0], int)
                    and shape[0] > 0 and shape[0] != sequence_length):
                cfg["shape"] = [sequence_length]
                adjustments.append(f"Input '{node_id}': sample shape {shape} -> [{sequence_length}] "
                                   f"to match sequence_length.")
        elif node_type in EMBEDDING_KEY:
            has_token_input = True
            _raise_if_smaller(cfg, VOCAB_KEYS, vocab_size, f"{node_type}", node_id, adjustments)
        elif node_type == "LMHead":
            has_head = True
            _raise_if_smaller(cfg, ("vocab_size", "out_features"), vocab_size, "LMHead", node_id, adjustments)
        elif node_type == "Architecture" and cfg.get("architecture") == "decoder_transformer_lm":
            has_token_input = has_head = True
            inner = cfg.get("config")
            if not isinstance(inner, dict):
                inner = {}
                cfg["config"] = inner
            _raise_if_smaller(inner, ARCH_VOCAB_KEYS, vocab_size,
                              "Architecture 'decoder_transformer_lm'", node_id, adjustments)
            _raise_if_smaller(inner, ("max_seq_len",), sequence_length,
                              "Architecture 'decoder_transformer_lm'", node_id, adjustments)
        elif node_type == "LearnedPositionEmbedding":
            _raise_if_smaller(cfg, ("max_seq_len",), sequence_length,
                              "LearnedPositionEmbedding", node_id, adjustments)
    if not has_token_input:
        raise ValueError(
            "This graph has no token embedding. Causal-language-model training needs a "
            "TokenEmbedding (or a decoder_transformer_lm Architecture) fed by an integer Input node."
        )
    if not has_head:
        raise ValueError(
            "This graph has no language-model head. Connect an LMHead (vocab_size = tokenizer "
            "vocabulary) to the Output node so the run can predict the next token."
        )
    return payload, adjustments


def _graph_vocab(graph_payload: dict[str, Any]) -> int | None:
    """Largest vocabulary the graph declares, used to explain alignment in the UI."""
    widths: list[int] = []
    for node in graph_payload.get("nodes") or []:
        if not isinstance(node, dict):
            continue
        cfg = node.get("config") if isinstance(node.get("config"), dict) else {}
        node_type = node.get("type")
        if node_type in EMBEDDING_KEY:
            keys = VOCAB_KEYS
        elif node_type == "LMHead":
            keys = ("vocab_size", "out_features")
        elif node_type == "Architecture" and cfg.get("architecture") == "decoder_transformer_lm":
            cfg = cfg.get("config") if isinstance(cfg.get("config"), dict) else {}
            keys = ARCH_VOCAB_KEYS
        else:
            continue
        widths.extend(int(cfg[key]) for key in keys if isinstance(cfg.get(key), int))
    return max(widths) if widths else None


def _resolve_dataset(path_value: str) -> Path:
    dataset = Path(path_value).expanduser()
    if not dataset.is_absolute():
        dataset = (ROOT / dataset).resolve()
    if not dataset.is_file():
        raise FileNotFoundError(
            f"Dataset file not found: {dataset}. Put a .txt file there or change 'Dataset text file' "
            "in the Train tab."
        )
    return dataset


def _load_tokenizer(name: str):
    """Load (and memoize) a Hugging Face tokenizer so preflight and training share one object."""
    with _LOCK:
        cached = _TOKENIZERS.get(name)
    if cached is not None:
        return cached

    from transformers import AutoTokenizer

    try:
        tokenizer = AutoTokenizer.from_pretrained(name)
    except Exception as exc:  # Network, typo, or a non-tokenizer repo id all land here.
        raise ValueError(
            f"Tokenizer '{name}' could not be loaded: {exc}. Use a Hugging Face tokenizer id "
            "(for example 'gpt2') that is downloadable or already cached locally."
        ) from exc
    with _LOCK:
        _TOKENIZERS[name] = tokenizer
    return tokenizer


def _prepare_run(graph_payload: dict[str, Any], settings: dict[str, Any]) -> dict[str, Any]:
    """Validate, tokenize and align a run; raises with user-facing messages on any blocker."""
    from backend.thinknet_backend_core import CompiledGraph, GraphDef, validate_graph

    graph = GraphDef.model_validate(graph_payload)
    errors = validate_graph(graph)
    if errors:
        raise ValueError("Invalid graph: " + "; ".join(errors))
    if not graph.nodes:
        raise ValueError("The graph is empty.")

    dataset = _resolve_dataset(settings["dataset_path"])
    text = dataset.read_text(encoding="utf-8")
    if not text.strip():
        raise ValueError(f"Dataset is empty: {dataset}")

    tokenizer = _load_tokenizer(settings["tokenizer_name"])
    token_ids = tokenizer.encode(text, add_special_tokens=False)
    seq_len = settings["sequence_length"]
    if len(token_ids) <= seq_len:
        raise ValueError(
            f"Dataset has {len(token_ids)} tokens; sequence_length={seq_len} needs at least "
            f"{seq_len + 1}. Add more text or reduce sequence length."
        )
    vocab_size = max(len(tokenizer), int(max(token_ids)) + 1)

    aligned_payload, adjustments = align_graph_for_causal_lm(
        graph_payload, vocab_size=vocab_size, sequence_length=seq_len
    )
    aligned_graph = GraphDef.model_validate(aligned_payload)
    graph_errors = validate_graph(aligned_graph)
    if graph_errors:
        raise ValueError("Invalid graph after vocabulary alignment: " + "; ".join(graph_errors))
    model = CompiledGraph(aligned_graph)
    parameter_count = sum(p.numel() for p in model.parameters())
    if parameter_count == 0:
        raise ValueError("The compiled graph has no trainable parameters.")

    return {
        "model": model,
        "graph": aligned_graph,
        "graph_payload": aligned_payload,
        "adjustments": adjustments,
        "token_ids": token_ids,
        "vocab_size": vocab_size,
        "tokenizer_name": settings["tokenizer_name"],
        "dataset_path": str(dataset),
        "parameter_count": parameter_count,
    }


def _archive_artifacts(output: Path) -> Path:
    archive = output / "thinknet-training-artifacts.zip"
    if archive.exists():
        archive.unlink()
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(output.rglob("*")):
            if path.is_file() and path != archive:
                zf.write(path, arcname=path.relative_to(output))
    return archive


def _finalize(output: Path, *, job_id: str, status: str, model, tokenizer,
              graph_payload: dict[str, Any], settings: dict[str, Any], prepared: dict[str, Any],
              step: int, parameter_count: int, elapsed: float) -> list[str]:
    """Write every artifact a run needs, including partial progress for cancelled runs."""
    model.eval()
    torch.save(model.state_dict(), output / "model_state_dict.pt")
    (output / "graph.json").write_text(json.dumps(graph_payload, indent=2), encoding="utf-8")
    (output / "training.json").write_text(json.dumps(settings, indent=2), encoding="utf-8")

    tokenizer_files: list[str] = []
    tokenizer_dir = output / "tokenizer"
    try:
        tokenizer.save_pretrained(tokenizer_dir)
        tokenizer_files = sorted(
            str(p.relative_to(output).as_posix()) for p in tokenizer_dir.rglob("*") if p.is_file()
        )
    except Exception as exc:  # A custom tokenizer must never cost the user its weights.
        (output / "tokenizer.error.txt").write_text(str(exc), encoding="utf-8")

    files = sorted(str(p.relative_to(output).as_posix()) for p in output.rglob("*") if p.is_file())
    manifest = {
        "job_id": job_id,
        "task": "causal_language_modeling",
        "status": status,
        "device": _device_name(model),
        "parameter_count": parameter_count,
        "vocabulary_size": prepared["vocab_size"],
        "tokenizer": {"name": prepared["tokenizer_name"], "files": tokenizer_files},
        "token_count": len(prepared["token_ids"]),
        "sequence_length": settings["sequence_length"],
        "batch_size": settings["batch_size"],
        "steps_completed": step,
        "total_steps": settings["max_steps"],
        "graph_adjustments": prepared["adjustments"],
        "checkpoint_policy": {
            "step_checkpoints_kept": KEEP_STEP_CHECKPOINTS,
            "step_checkpoints_include_optimizer": False,
            "resumable_checkpoint": "checkpoint-last.pt",
        },
        "elapsed_seconds": round(elapsed, 3),
        "completed_at": _utc_now(),
        "files": files,
    }
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    _archive_artifacts(output)
    return files


def _run_job(job_id: str, graph_payload: dict[str, Any], settings: dict[str, Any]) -> None:
    cancel = _CANCEL[job_id]
    output = JOB_ROOT / job_id
    output.mkdir(parents=True, exist_ok=True)
    started = time.time()
    model = tokenizer = prepared = None
    step = 0
    parameter_count = 0
    try:
        _update(job_id, phase="preparing", message="Validating graph, dataset and tokenizer.")
        prepared = _prepare_run(graph_payload, settings)
        tokenizer = _load_tokenizer(prepared["tokenizer_name"])
        token_ids = prepared["token_ids"]
        graph_payload = prepared["graph_payload"]

        torch.manual_seed(settings["seed"])
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        model = prepared["model"].to(device)
        parameter_count = sum(p.numel() for p in model.parameters())
        optimizer = torch.optim.AdamW(
            model.parameters(),
            lr=settings["learning_rate"],
            weight_decay=settings["weight_decay"],
        )
        metrics_path = output / "metrics.jsonl"
        metrics_path.write_text("", encoding="utf-8")
        seq_len = settings["sequence_length"]
        _update(
            job_id,
            status="running",
            phase="training",
            device=str(device),
            parameter_count=parameter_count,
            token_count=len(token_ids),
            vocabulary_size=prepared["vocab_size"],
            graph_adjustments=prepared["adjustments"],
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
        cancelled = False
        step = 0
        for step in range(1, settings["max_steps"] + 1):
            if cancel.is_set():
                cancelled = True
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
                    f"Model vocabulary ({logits.shape[-1]}) still does not cover tokenizer token IDs "
                    f"(max observed ID {int(y.max())}); report this with the graph so vocabulary alignment "
                    "can be extended."
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

            if step % settings["save_every_steps"] == 0:
                _save_checkpoint(output, model, optimizer, step, graph_payload, settings,
                                 include_optimizer=False)

        steps_done = step - 1 if cancelled else step
        status = "cancelled" if cancelled else "completed"
        _update(job_id, phase="saving", message="Saving weights, checkpoints and metrics.")
        if steps_done >= 1:
            _save_checkpoint(output, model, optimizer, steps_done, graph_payload, settings,
                             name="checkpoint-last.pt")
            _finalize(output, job_id=job_id, status=status, model=model, tokenizer=tokenizer,
                      graph_payload=graph_payload, settings=settings, prepared=prepared,
                      step=steps_done, parameter_count=parameter_count, elapsed=time.time() - started)
        if cancelled:
            _update(
                job_id,
                status="cancelled",
                phase="cancelled",
                step=steps_done,
                progress=round(100 * steps_done / settings["max_steps"], 2),
                completed_at=_utc_now(),
                elapsed_seconds=round(time.time() - started, 3),
                artifact_available=(output / "thinknet-training-artifacts.zip").is_file(),
                message=(f"Training cancelled at step {steps_done}/{settings['max_steps']}. "
                         "Weights and checkpoints up to that step were saved."),
            )
            return

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
            error=f"{exc} (checkpoints up to step {step} remain in {output})",
            message=str(exc),
            traceback=traceback.format_exc(limit=8),
            completed_at=_utc_now(),
        )


def _save_checkpoint(output: Path, model, optimizer, step: int, graph_payload: dict[str, Any],
                     settings: dict[str, Any], name: str | None = None,
                     include_optimizer: bool = True) -> Path:
    path = output / (name or f"checkpoint-{step}.pt")
    payload = {
        "model_state_dict": model.state_dict(),
        "step": step,
        "graph": graph_payload,
        "training": settings,
    }
    if include_optimizer:
        payload["optimizer_state_dict"] = optimizer.state_dict()
    torch.save(payload, path)
    if name is None:
        _prune_step_checkpoints(output)
    return path


def _step_checkpoint_files(output: Path) -> list[Path]:
    """Numeric step checkpoints, oldest first (``checkpoint-last.pt`` is never rotated)."""
    numbered = []
    for path in output.glob("checkpoint-*.pt"):
        step = path.stem[len("checkpoint-"):]
        if step.isdigit():
            numbered.append((int(step), path))
    return [path for _, path in sorted(numbered)]


def _prune_step_checkpoints(output: Path) -> None:
    for path in _step_checkpoint_files(output)[:-KEEP_STEP_CHECKPOINTS]:
        try:
            path.unlink()
        except OSError:  # A locked file must not fail the run.
            return


def _device_name(model) -> str:
    for parameter in model.parameters():
        return str(parameter.device)
    return "cpu"



@router.post("/jobs/preflight")
def preflight_training_job(payload: TrainingJobRequest):
    """Report whether this graph + dataset + tokenizer can train, without running a step."""
    settings = payload.training.model_dump()
    model_vocab = _graph_vocab(payload.graph)
    try:
        prepared = _prepare_run(payload.graph, settings)
    except Exception as exc:  # Surfaced verbatim in the Train tab, so messages must stay actionable.
        return {
            "ready": False,
            "errors": [str(exc)],
            "warnings": [],
            "graph_adjustments": [],
            "model_vocab_size": model_vocab,
            "vocabulary_size": None,
            "parameter_count": None,
            "token_count": None,
            "tokenizer_name": settings["tokenizer_name"],
            "dataset_path": settings["dataset_path"],
            "message": "Fix the issue above, then check again.",
        }

    vocab_size = prepared["vocab_size"]
    token_count = len(prepared["token_ids"])
    warnings: list[str] = []
    if model_vocab is not None and model_vocab < vocab_size:
        warnings.append(
            f"Vocabulary grows from {model_vocab} to {vocab_size} so every token ID fits. "
            "The run saves the widened graph alongside the weights."
        )
    logits_mb = (settings["batch_size"] * settings["sequence_length"] * vocab_size * 4) / (1024 * 1024)
    if logits_mb > 256:
        warnings.append(
            f"Each step allocates about {logits_mb:.0f} MB of logits on CPU. "
            "Reduce batch size or sequence length if steps run slowly."
        )
    if token_count < 2000:
        warnings.append(
            f"The dataset is only {token_count} tokens. Training will run, but expect loss to plateau quickly."
        )

    return {
        "ready": True,
        "errors": [],
        "warnings": warnings,
        "graph_adjustments": prepared["adjustments"],
        "model_vocab_size": model_vocab,
        "vocabulary_size": vocab_size,
        "parameter_count": prepared["parameter_count"],
        "token_count": token_count,
        "tokenizer_name": prepared["tokenizer_name"],
        "dataset_path": prepared["dataset_path"],
        "sequence_length": settings["sequence_length"],
        "batch_size": settings["batch_size"],
        "max_steps": settings["max_steps"],
        "message": "Ready to train.",
    }


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
        "vocabulary_size": None,
        "graph_adjustments": [],
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
    if status not in {"completed", "cancelled"} or not archive.is_file():
        raise HTTPException(
            status_code=409,
            detail="Artifacts are available once a run completes or is cancelled after at least one step.",
        )
    return FileResponse(archive, media_type="application/zip", filename=f"thinknet-{job_id}-artifacts.zip")
