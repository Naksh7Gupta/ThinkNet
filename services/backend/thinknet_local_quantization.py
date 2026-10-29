"""Local Hugging Face checkpoint inspection and FP16/BF16 conversion jobs."""
from __future__ import annotations

import ctypes
import json
import math
import os
import pickle
import re
import shutil
import tempfile
import threading
import zipfile
from datetime import datetime, timezone
from pathlib import Path, PureWindowsPath
from typing import Any, Callable, Literal
from uuid import uuid4

import torch
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(tags=["local-model-quantization"])

TARGET_DTYPES: dict[str, torch.dtype] = {
    "float16": torch.float16,
    "bfloat16": torch.bfloat16,
}
DTYPE_BYTES = {
    "F64": 8, "F32": 4, "F16": 2, "BF16": 2,
    "F8_E4M3": 1, "F8_E5M2": 1,
    "I64": 8, "U64": 8, "I32": 4, "U32": 4,
    "I16": 2, "U16": 2, "I8": 1, "U8": 1, "BOOL": 1,
}
FLOAT_DTYPES = {"F64", "F32", "F16", "BF16", "F8_E4M3", "F8_E5M2"}
PYTORCH_CHECKPOINT_SUFFIXES = {".pt", ".pth", ".bin", ".ckpt"}
AUXILIARY_CHECKPOINT_FILES = {
    "model.safetensors.index.json",
    "pytorch_model.bin.index.json",
}
AUXILIARY_FILES = {
    "tokenizer.json", "tokenizer_config.json", "special_tokens_map.json",
    "added_tokens.json", "vocab.json", "vocab.txt", "merges.txt",
    "spiece.model", "sentencepiece.bpe.model", "chat_template.jinja",
    "processor_config.json", "preprocessor_config.json",
}
MEMORY_OVERHEAD_BYTES = 256 * 1024 * 1024
_JOBS: dict[str, dict[str, Any]] = {}
_JOB_LOCK = threading.Lock()
_ACTIVE_JOB_ID: str | None = None


class LocalModelError(ValueError):
    """A selected model or target cannot be processed safely by this backend."""


class LocalModelInspectRequest(BaseModel):
    model_path: str = Field(min_length=1, max_length=4096)


class LocalModelQuantizationRequest(LocalModelInspectRequest):
    output_directory: str = Field(min_length=1, max_length=4096)
    output_name: str = Field(min_length=1, max_length=128)
    dtype: Literal["float16", "bfloat16"]


def _transformers():
    try:
        from safetensors import safe_open
        from transformers import AutoConfig, AutoModel, AutoModelForCausalLM
    except ImportError as exc:
        raise LocalModelError(
            "Local model conversion requires Transformers and safetensors. "
            "Install the backend requirements and restart ThinkNet."
        ) from exc
    return AutoConfig, AutoModel, AutoModelForCausalLM, safe_open


def _safe_torch_state_dict(path: Path) -> dict[str, torch.Tensor]:
    if not zipfile.is_zipfile(path):
        raise LocalModelError(
            f"{path.name} is not a modern tensor-only PyTorch checkpoint. "
            "Legacy pickle checkpoint formats are not supported."
        )
    try:
        # weights_only prevents unpickling arbitrary Python objects from checkpoints.
        checkpoint = torch.load(path, map_location="cpu", weights_only=True)
    except (OSError, EOFError, RuntimeError, ValueError, TypeError, pickle.UnpicklingError) as exc:
        raise LocalModelError(
            f"Could not safely read {path.name}. Use a tensor state dictionary saved "
            "with torch.save; checkpoints requiring unrestricted pickle loading are not supported."
        ) from exc

    if isinstance(checkpoint, dict):
        state_dict: Any = checkpoint
        if not checkpoint or not all(isinstance(value, torch.Tensor) for value in checkpoint.values()):
            state_dict = next(
                (
                    checkpoint[key]
                    for key in ("state_dict", "model_state_dict", "model")
                    if isinstance(checkpoint.get(key), dict)
                    and checkpoint[key]
                    and all(isinstance(value, torch.Tensor) for value in checkpoint[key].values())
                ),
                None,
            )
        if isinstance(state_dict, dict) and state_dict and all(
            isinstance(key, str) and isinstance(value, torch.Tensor)
            for key, value in state_dict.items()
        ):
            return state_dict
    raise LocalModelError(
        f"{path.name} does not contain a plain tensor state dictionary. "
        "Pickled model objects and optimizer/training bundles are not supported."
    )


def _index_weight_files(root: Path, index: Path, suffixes: set[str]) -> list[Path]:
    if index.is_symlink():
        raise LocalModelError(f"Checkpoint index {index.name} cannot be a symbolic link.")
    try:
        weight_map = json.loads(index.read_text(encoding="utf-8"))["weight_map"]
        names = set(weight_map.values())
    except (OSError, ValueError, KeyError, TypeError, AttributeError) as exc:
        raise LocalModelError(f"The checkpoint index {index.name} is invalid.") from exc
    if not names:
        raise LocalModelError(f"The checkpoint index {index.name} contains no weight files.")
    files = []
    for name in names:
        if (
            not isinstance(name, str)
            or Path(name).name != name
            or PureWindowsPath(name).name != name
            or Path(name).suffix.lower() not in suffixes
        ):
            raise LocalModelError(f"The checkpoint index contains an unsafe or unsupported file: {name}.")
        file_path = root / name
        if not file_path.is_file() or file_path.is_symlink():
            raise LocalModelError(f"Missing or invalid checkpoint shard: {name}.")
        files.append(file_path)
    return sorted(files)


def _model_root(model_path: str | Path) -> Path:
    try:
        requested = Path(model_path).expanduser()
        if requested.is_symlink():
            raise LocalModelError("Model paths cannot be symbolic links.")
        root = requested.resolve(strict=True)
    except (OSError, RuntimeError) as exc:
        raise LocalModelError(f"Model directory does not exist: {model_path}") from exc
    if root.is_file():
        if root.suffix.lower() not in PYTORCH_CHECKPOINT_SUFFIXES | {".safetensors"}:
            raise LocalModelError(
                "Unsupported model file. Choose a .safetensors, .pt, .pth, .bin, or .ckpt "
                "checkpoint with a Hugging Face config.json alongside it."
            )
        if root.is_symlink():
            raise LocalModelError("Model checkpoint files cannot be symbolic links.")
        root = root.parent
    if not root.is_dir():
        raise LocalModelError("Select a model directory or a supported checkpoint file.")
    if not (root / "config.json").is_file() or (root / "config.json").is_symlink():
        raise LocalModelError("Unsupported model format: expected a local Hugging Face config.json.")
    return root


def _resolve_model_input(model_path: str | Path) -> tuple[Path, Path | None]:
    requested = Path(model_path).expanduser()
    root = _model_root(requested)
    if requested.is_file():
        return root, requested.resolve(strict=True)
    return root, None


def _weight_files(root: Path, selected_file: Path | None = None) -> list[Path]:
    if selected_file is not None:
        if selected_file.parent != root or selected_file.is_symlink():
            raise LocalModelError("The selected checkpoint must be a regular file beside config.json.")
        return [selected_file]

    for index_name, suffixes in (
        ("model.safetensors.index.json", {".safetensors"}),
        ("pytorch_model.bin.index.json", {".bin"}),
    ):
        index = root / index_name
        if index.is_file():
            return _index_weight_files(root, index, suffixes)

    safe_files = sorted(root.glob("*.safetensors"))
    if safe_files:
        if any(file_path.is_symlink() for file_path in safe_files):
            raise LocalModelError("Safetensors checkpoint files cannot be symbolic links.")
        return safe_files

    checkpoint_files = sorted(
        path
        for path in root.iterdir()
        if path.is_file() and path.suffix.lower() in PYTORCH_CHECKPOINT_SUFFIXES
    )
    if any(file_path.is_symlink() for file_path in checkpoint_files):
        raise LocalModelError("PyTorch checkpoint files cannot be symbolic links.")
    if len(checkpoint_files) == 1:
        return checkpoint_files
    if len(checkpoint_files) > 1:
        raise LocalModelError(
            "Multiple PyTorch checkpoint files were found without a shard index. "
            "Select the intended checkpoint file directly."
        )
    raise LocalModelError(
        "No supported checkpoint found. Choose safetensors or a tensor-only .pt, .pth, "
        ".bin, or .ckpt state dictionary."
    )


def _checkpoint_metadata(root: Path, selected_file: Path | None = None) -> dict[str, Any]:
    AutoConfig, _, _, safe_open = _transformers()
    files = _weight_files(root, selected_file)
    try:
        config = AutoConfig.from_pretrained(
            str(root), local_files_only=True, trust_remote_code=False
        )
    except (OSError, ValueError, TypeError) as exc:
        raise LocalModelError(f"Could not read the local model configuration: {exc}") from exc

    tensor_count = 0
    parameter_count = 0
    weight_bytes = 0
    dtype_counts: dict[str, int] = {}
    try:
        for file_path in files:
            if file_path.suffix.lower() == ".safetensors":
                with safe_open(str(file_path), framework="pt", device="cpu") as checkpoint:
                    tensors = (
                        (key, checkpoint.get_slice(key).get_shape(), checkpoint.get_slice(key).get_dtype())
                        for key in checkpoint.keys()
                    )
                    for _, shape, dtype in tensors:
                        elements = math.prod(shape)
                        if dtype not in DTYPE_BYTES:
                            raise LocalModelError(f"Unsupported checkpoint tensor dtype {dtype!r}.")
                        tensor_count += 1
                        parameter_count += elements
                        weight_bytes += elements * DTYPE_BYTES[dtype]
                        dtype_counts[dtype] = dtype_counts.get(dtype, 0) + elements
            else:
                file_size = file_path.stat().st_size
                if not zipfile.is_zipfile(file_path):
                    raise LocalModelError(
                        f"{file_path.name} is a Legacy pickle checkpoint. "
                        "Only modern tensor-only PyTorch checkpoint files are supported."
                    )
                try:
                    with zipfile.ZipFile(file_path) as archive:
                        uncompressed_size = sum(
                            member.file_size for member in archive.infolist() if not member.is_dir()
                        )
                except (OSError, zipfile.BadZipFile, zipfile.LargeZipFile) as exc:
                    raise LocalModelError(
                        f"Could not inspect PyTorch checkpoint storage in {file_path.name}."
                    ) from exc
                required_memory = max(file_size, uncompressed_size) + MEMORY_OVERHEAD_BYTES
                available_memory = available_system_memory_bytes()
                if available_memory < required_memory:
                    raise LocalModelError(
                        f"Insufficient available RAM to inspect this PyTorch checkpoint: "
                        f"about {required_memory:,} bytes required; {available_memory:,} available."
                    )
                state_dict = _safe_torch_state_dict(file_path)
                seen_storage: set[tuple[int, int, tuple[int, ...], torch.dtype]] = set()
                for tensor in state_dict.values():
                    if tensor.layout != torch.strided:
                        raise LocalModelError("Sparse and non-strided checkpoint tensors are unsupported.")
                    storage = tensor.untyped_storage()
                    identity = (storage.data_ptr(), tensor.storage_offset(), tuple(tensor.shape), tensor.dtype)
                    if identity in seen_storage:
                        continue
                    seen_storage.add(identity)
                    elements = tensor.numel()
                    dtype_name = str(tensor.dtype).removeprefix("torch.")
                    dtype_aliases = {
                        "float64": "F64", "float32": "F32", "float16": "F16",
                        "bfloat16": "BF16", "int64": "I64", "int32": "I32",
                        "int16": "I16", "int8": "I8", "uint8": "U8", "bool": "BOOL",
                    }
                    safe_dtype = dtype_aliases.get(dtype_name)
                    if safe_dtype is None:
                        raise LocalModelError(f"Unsupported PyTorch tensor dtype {dtype_name!r}.")
                    tensor_count += 1
                    parameter_count += elements
                    weight_bytes += elements * DTYPE_BYTES[safe_dtype]
                    dtype_counts[safe_dtype] = dtype_counts.get(safe_dtype, 0) + elements
    except LocalModelError:
        raise
    except (OSError, RuntimeError, ValueError, EOFError) as exc:
        raise LocalModelError(f"Could not inspect checkpoint weights: {exc}") from exc
    if tensor_count == 0:
        raise LocalModelError("The selected checkpoint contains no tensors.")

    source_size_bytes = sum(
        file.stat().st_size
        for path, _, names in os.walk(root)
        for name in names
        if not (file := Path(path) / name).is_symlink()
    )
    architecture_names = getattr(config, "architectures", None) or []
    if isinstance(architecture_names, str):
        architecture_names = [architecture_names]
    if not isinstance(architecture_names, (list, tuple)):
        architecture_names = []
    architecture_names = [str(name) for name in architecture_names if name]
    architecture = ", ".join(architecture_names) if architecture_names else str(
        getattr(config, "model_type", "Unknown")
    )
    return {
        "model_name": root.name,
        "format": (
            "Hugging Face safetensors"
            if selected_file is None
            and all(file_path.suffix.lower() == ".safetensors" for file_path in files)
            else "Safetensors checkpoint"
            if all(file_path.suffix.lower() == ".safetensors" for file_path in files)
            else "PyTorch state dictionary"
        ),
        "architecture": architecture,
        "model_type": str(getattr(config, "model_type", "unknown")),
        "parameter_count": parameter_count,
        "tensor_count": tensor_count,
        "size_bytes": source_size_bytes,
        "weight_bytes": weight_bytes,
        "dtype_counts": dtype_counts,
    }


def inspect_local_model(model_path: str) -> dict[str, Any]:
    root, selected_file = _resolve_model_input(model_path)
    return _checkpoint_metadata(root, selected_file)


def available_system_memory_bytes() -> int:
    """Return available host RAM without adding a platform-specific dependency."""
    if os.name == "nt":
        class MemoryStatus(ctypes.Structure):
            _fields_ = [
                ("dwLength", ctypes.c_ulong),
                ("dwMemoryLoad", ctypes.c_ulong),
                ("ullTotalPhys", ctypes.c_ulonglong),
                ("ullAvailPhys", ctypes.c_ulonglong),
                ("ullTotalPageFile", ctypes.c_ulonglong),
                ("ullAvailPageFile", ctypes.c_ulonglong),
                ("ullTotalVirtual", ctypes.c_ulonglong),
                ("ullAvailVirtual", ctypes.c_ulonglong),
                ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
            ]

        status = MemoryStatus()
        status.dwLength = ctypes.sizeof(status)
        if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status)):
            raise LocalModelError("Could not determine available system memory.")
        return int(status.ullAvailPhys)
    try:
        return int(os.sysconf("SC_AVPHYS_PAGES") * os.sysconf("SC_PAGE_SIZE"))
    except (OSError, ValueError, TypeError) as exc:
        raise LocalModelError("Could not determine available system memory.") from exc


def _validate_output(
    source: Path, info: dict[str, Any], output_directory: str, output_name: str, dtype: str
) -> tuple[Path, Path, int]:
    if dtype not in TARGET_DTYPES:
        raise LocalModelError("Supported local checkpoint conversions are FP16 and BF16.")
    floating_source_dtypes = set(info["dtype_counts"]).intersection(FLOAT_DTYPES)
    if not floating_source_dtypes:
        raise LocalModelError("The selected checkpoint has no floating-point tensors to convert.")
    target_safe_dtype = "F16" if dtype == "float16" else "BF16"
    if floating_source_dtypes == {target_safe_dtype}:
        raise LocalModelError(f"The model already uses {dtype}; no conversion is needed.")
    windows_stem = output_name.rstrip(" .").split(".", 1)[0].upper()
    reserved_windows_names = {"CON", "PRN", "AUX", "NUL"} | {
        f"{prefix}{number}" for prefix in ("COM", "LPT") for number in range(1, 10)
    }
    if (
        output_name in {".", ".."}
        or output_name != output_name.strip()
        or output_name.endswith(".")
        or windows_stem in reserved_windows_names
        or not re.fullmatch(r"[^<>:\"/\\\\|?*\x00]+", output_name)
        or PureWindowsPath(output_name).name != output_name
    ):
        raise LocalModelError("Output name must be a single valid folder name.")
    try:
        parent = Path(output_directory).expanduser().resolve(strict=True)
    except (OSError, RuntimeError) as exc:
        raise LocalModelError("Choose an existing output directory.") from exc
    if not parent.is_dir() or not os.access(parent, os.W_OK):
        raise LocalModelError("The selected output location is not a writable directory.")
    target = parent / output_name
    if target.exists() or target.is_symlink():
        raise LocalModelError(f"Output already exists and will not be overwritten: {target}")
    if source == target or source in target.parents or target in source.parents:
        raise LocalModelError("The output directory must not overlap the original model directory.")

    parameter_count = info["parameter_count"]
    expected_output_bytes = parameter_count * 2
    memory_multiplier = 1.5 if info["format"] == "Hugging Face safetensors" else 3.5
    required_memory = math.ceil(info["weight_bytes"] * memory_multiplier) + MEMORY_OVERHEAD_BYTES
    available_memory = available_system_memory_bytes()
    if available_memory < required_memory:
        raise LocalModelError(
            f"Insufficient available RAM: conversion needs about {required_memory:,} bytes "
            f"including safety overhead; {available_memory:,} bytes are available."
        )
    source_auxiliary_bytes = max(0, info["size_bytes"] - info["weight_bytes"])
    required_disk = expected_output_bytes + source_auxiliary_bytes + MEMORY_OVERHEAD_BYTES // 8
    if shutil.disk_usage(parent).free < required_disk:
        raise LocalModelError(
            f"Insufficient free disk space: output may need about {required_disk:,} bytes."
        )
    return parent, target, required_memory


def _model_class(config: Any, auto_model: Any, auto_causal_model: Any):
    architectures = getattr(config, "architectures", None) or []
    if isinstance(architectures, str):
        architectures = [architectures]
    if not isinstance(architectures, (list, tuple)):
        architectures = []
    if any(
        isinstance(name, str) and name.endswith(("ForCausalLM", "LMHeadModel"))
        for name in architectures
    ):
        return auto_causal_model
    return auto_model


def _load_checkpoint_model(
    root: Path,
    files: list[Path],
    config: Any,
    model_type: Any,
    selected_file: Path | None,
) -> torch.nn.Module:
    if (
        selected_file is None
        and all(file_path.suffix.lower() == ".safetensors" for file_path in files)
    ):
        return model_type.from_pretrained(
            str(root),
            config=config,
            local_files_only=True,
            trust_remote_code=False,
            use_safetensors=True,
            low_cpu_mem_usage=True,
        )

    model = model_type.from_config(config, trust_remote_code=False)
    state_dict: dict[str, torch.Tensor] = {}
    for file_path in files:
        if file_path.suffix.lower() == ".safetensors":
            from safetensors.torch import load_file

            shard = load_file(str(file_path), device="cpu")
        else:
            shard = _safe_torch_state_dict(file_path)
        duplicates = state_dict.keys() & shard.keys()
        if duplicates:
            raise LocalModelError(
                f"PyTorch checkpoint shards contain duplicate tensor keys: {', '.join(sorted(duplicates)[:5])}."
            )
        state_dict.update(shard)

    if state_dict and all(key.startswith("module.") for key in state_dict):
        state_dict = {key.removeprefix("module."): value for key, value in state_dict.items()}
    try:
        incompatible = model.load_state_dict(state_dict, strict=False)
    except (RuntimeError, ValueError, TypeError) as exc:
        raise LocalModelError(f"PyTorch tensor names or shapes do not match this model config: {exc}") from exc
    if incompatible.missing_keys or incompatible.unexpected_keys:
        missing = ", ".join(incompatible.missing_keys[:5]) or "none"
        unexpected = ", ".join(incompatible.unexpected_keys[:5]) or "none"
        raise LocalModelError(
            "PyTorch state dictionary does not match the configured Hugging Face model "
            f"(missing: {missing}; unexpected: {unexpected})."
        )
    return model


def quantize_local_model(
    model_path: str,
    output_directory: str,
    output_name: str,
    dtype: str,
    on_progress: Callable[[str, int], None] | None = None,
) -> dict[str, Any]:
    """Convert a local checkpoint into a new validated safetensors model directory."""
    report_progress = on_progress or (lambda _phase, _progress: None)
    source, selected_file = _resolve_model_input(model_path)
    files = _weight_files(source, selected_file)
    info = _checkpoint_metadata(source, selected_file)
    parent, target, _ = _validate_output(source, info, output_directory, output_name, dtype)
    AutoConfig, AutoModel, AutoModelForCausalLM, _ = _transformers()
    target_dtype = TARGET_DTYPES[dtype]
    target_safe_dtype = "F16" if dtype == "float16" else "BF16"

    report_progress("Loading model", 20)
    try:
        config = AutoConfig.from_pretrained(
            str(source), local_files_only=True, trust_remote_code=False
        )
        model_type = _model_class(config, AutoModel, AutoModelForCausalLM)
        model = _load_checkpoint_model(source, files, config, model_type, selected_file)
    except (OSError, ValueError, TypeError, RuntimeError) as exc:
        raise LocalModelError(f"Could not load this model with the supported Transformers backend: {exc}") from exc

    temporary_directory: Path | None = None
    try:
        report_progress("Converting weights", 55)
        model.to(dtype=target_dtype)
        model.eval()
        report_progress("Writing safetensors output", 75)
        temporary_directory = Path(tempfile.mkdtemp(prefix=f".{output_name}.thinknet-", dir=parent))
        model.save_pretrained(str(temporary_directory), safe_serialization=True)
        for filename in AUXILIARY_FILES:
            auxiliary = source / filename
            if auxiliary.is_file() and not auxiliary.is_symlink():
                shutil.copy2(auxiliary, temporary_directory / filename)

        report_progress("Validating saved checkpoint", 92)
        validated = _checkpoint_metadata(temporary_directory)
        if validated["parameter_count"] != info["parameter_count"]:
            raise LocalModelError("Output validation failed: checkpoint tensor count changed.")
        target_elements = validated["dtype_counts"].get(target_safe_dtype, 0)
        expected_float_elements = sum(
            elements for safe_dtype, elements in info["dtype_counts"].items()
            if safe_dtype in FLOAT_DTYPES
        )
        if target_elements != expected_float_elements:
            raise LocalModelError(
                f"Output validation failed: expected {expected_float_elements:,} floating "
                f"parameters in {dtype}, found {target_elements:,}."
            )
        output_size = sum(
            file.stat().st_size
            for path, _, names in os.walk(temporary_directory)
            for name in names
            if not (file := Path(path) / name).is_symlink()
        )
        del model
        if target.exists():
            raise LocalModelError(f"Output appeared during conversion; refusing to overwrite: {target}")
        temporary_directory.rename(target)
        temporary_directory = None

        reduction_bytes = info["size_bytes"] - output_size
        return {
            "output_path": str(target),
            "format": "Hugging Face safetensors",
            "dtype": dtype,
            "parameter_count": validated["parameter_count"],
            "source_size_bytes": info["size_bytes"],
            "output_size_bytes": output_size,
            "size_reduction_bytes": reduction_bytes,
            "size_reduction_percent": (
                round(reduction_bytes * 100 / info["size_bytes"], 2)
                if info["size_bytes"] else 0
            ),
            "validation_status": "passed",
            "validation_message": (
                "Safetensors headers, model configuration, tensor count, and converted floating "
                "tensor dtypes were validated."
            ),
        }
    finally:
        if temporary_directory is not None and temporary_directory.exists():
            shutil.rmtree(temporary_directory)


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _public_job(job: dict[str, Any]) -> dict[str, Any]:
    return dict(job)


def _update_job(job_id: str, **values: Any) -> None:
    with _JOB_LOCK:
        job = _JOBS.get(job_id)
        if job is not None:
            job.update(values)
            job["updated_at"] = _utc_now()


def _run_job(job_id: str, payload: LocalModelQuantizationRequest) -> None:
    global _ACTIVE_JOB_ID
    try:
        _update_job(job_id, status="running", phase="Preparing model", progress=5)

        def update(phase: str, progress: int) -> None:
            _update_job(job_id, phase=phase, progress=progress)

        result = quantize_local_model(
            payload.model_path,
            payload.output_directory,
            payload.output_name,
            payload.dtype,
            update,
        )
        _update_job(job_id, status="completed", phase="Complete", progress=100, result=result, error=None)
    except Exception as exc:
        _update_job(job_id, status="failed", phase="Failed", error=str(exc))
    finally:
        with _JOB_LOCK:
            if _ACTIVE_JOB_ID == job_id:
                _ACTIVE_JOB_ID = None


@router.post("/api/v1/local-models/inspect")
def inspect_local_model_endpoint(payload: LocalModelInspectRequest):
    try:
        return inspect_local_model(payload.model_path)
    except LocalModelError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/api/v1/local-models/quantization-jobs")
def start_local_quantization_job(payload: LocalModelQuantizationRequest):
    global _ACTIVE_JOB_ID
    try:
        source, selected_file = _resolve_model_input(payload.model_path)
        info = _checkpoint_metadata(source, selected_file)
        _validate_output(
            source, info, payload.output_directory, payload.output_name, payload.dtype
        )
    except LocalModelError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    with _JOB_LOCK:
        if _ACTIVE_JOB_ID is not None:
            raise HTTPException(
                status_code=409,
                detail="Another local model conversion is active; wait for it to finish first.",
            )
        job_id = uuid4().hex
        now = _utc_now()
        job = {
            "job_id": job_id,
            "status": "queued",
            "phase": "Queued",
            "progress": 0,
            "message": f"Converting {info['model_name']} to {payload.dtype}.",
            "error": None,
            "result": None,
            "created_at": now,
            "updated_at": now,
        }
        _JOBS[job_id] = job
        _ACTIVE_JOB_ID = job_id
    threading.Thread(target=_run_job, args=(job_id, payload), daemon=True).start()
    return _public_job(job)


@router.get("/api/v1/local-models/quantization-jobs/{job_id}")
def get_local_quantization_job(job_id: str):
    with _JOB_LOCK:
        job = _JOBS.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail=f"Unknown quantization job '{job_id}'.")
        return _public_job(job)
