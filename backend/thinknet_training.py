"""ThinkNet training configuration and notebook generation (initial text-LM workflow)."""
from __future__ import annotations
import json
from typing import Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, model_validator

router = APIRouter(prefix="/api/v1/training", tags=["training"])

class TrainingSettings(BaseModel):
    learning_rate: float = Field(default=3e-4, gt=0, le=1.0)
    batch_size: int = Field(default=4, ge=1, le=1024)
    sequence_length: int = Field(default=128, ge=2, le=8192)
    max_steps: int = Field(default=100, ge=1, le=10_000_000)
    log_every_steps: int = Field(default=10, ge=1, le=1_000_000)
    save_every_steps: int = Field(default=50, ge=1, le=1_000_000)
    weight_decay: float = Field(default=0.01, ge=0, le=10)
    gradient_clip_norm: float = Field(default=1.0, gt=0, le=1000)
    seed: int = Field(default=42, ge=0, le=2**32 - 1)
    tokenizer_name: str = Field(default="gpt2", min_length=1, max_length=200)
    dataset_path: str = Field(default="backend/data/text.txt", min_length=1, max_length=500)
    output_dir: str = Field(default="training_output", min_length=1, max_length=500)

    @model_validator(mode="after")
    def validate_intervals(self):
        if self.log_every_steps > self.max_steps:
            raise ValueError("log_every_steps cannot exceed max_steps")
        if self.save_every_steps > self.max_steps:
            raise ValueError("save_every_steps cannot exceed max_steps")
        return self

class NotebookRequest(BaseModel):
    graph: dict[str, Any]
    training: TrainingSettings = Field(default_factory=TrainingSettings)

def _cell(cell_type: str, source: str) -> dict[str, Any]:
    cell = {"cell_type": cell_type, "metadata": {}, "source": source.splitlines(keepends=True)}
    if cell_type == "code":
        cell.update({"execution_count": None, "outputs": []})
    return cell

def build_training_notebook(graph: dict[str, Any], settings: TrainingSettings) -> dict[str, Any]:
    graph_json = json.dumps(graph, indent=2, sort_keys=True)
    config_json = json.dumps(settings.model_dump(), indent=2, sort_keys=True)
    cells = [
        _cell("markdown", "# ThinkNet Training Notebook\n\nGenerated from a validated ThinkNet graph. This first workflow targets causal language modelling with a local text file. Install the backend requirements and transformers, check the dataset path, and run only in an environment you trust."),
        _cell("code", "!pip install -r backend/requirements.txt transformers\nimport json, time\nfrom pathlib import Path\nimport torch\nimport torch.nn.functional as F\nfrom transformers import AutoTokenizer\n"),
        _cell("code", "GRAPH_SPEC = " + graph_json + "\nTRAINING = " + config_json + "\n"),
        _cell("code",
            "torch.manual_seed(TRAINING['seed'])\n"
            "device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')\n"
            "print('Execution device:', device)\n"
            "tokenizer = AutoTokenizer.from_pretrained(TRAINING['tokenizer_name'])\n"
            "dataset_path = Path(TRAINING['dataset_path'])\n"
            "if not dataset_path.exists(): raise FileNotFoundError(str(dataset_path.resolve()))\n"
            "text = dataset_path.read_text(encoding='utf-8')\n"
            "if not text.strip(): raise ValueError('Dataset is empty')\n"
            "token_ids = tokenizer.encode(text, add_special_tokens=False)\n"
            "if len(token_ids) <= TRAINING['sequence_length']: raise ValueError('Dataset has too few tokens for sequence_length')\n"
            "print('Token count:', len(token_ids), '| tokenizer:', TRAINING['tokenizer_name'])\n"),
        _cell("code",
            "from backend.thinknet_backend_core import GraphDef, CompiledGraph, validate_graph\n"
            "graph = GraphDef.model_validate(GRAPH_SPEC)\n"
            "errors = validate_graph(graph)\n"
            "if errors: raise ValueError('Invalid graph: ' + '; '.join(errors))\n"
            "model = CompiledGraph(graph).to(device)\n"
            "print('Parameters:', sum(p.numel() for p in model.parameters()))\n"
            "optimizer = torch.optim.AdamW(model.parameters(), lr=TRAINING['learning_rate'], weight_decay=TRAINING['weight_decay'])\n"
            "out = Path(TRAINING['output_dir']); out.mkdir(parents=True, exist_ok=True)\n"
            "metrics_file = out / 'metrics.jsonl'\n"
            "def sample_batch():\n"
            "    n = TRAINING['sequence_length']; b = TRAINING['batch_size']\n"
            "    starts = torch.randint(0, len(token_ids)-n-1, (b,))\n"
            "    x = torch.stack([torch.tensor(token_ids[s:s+n], dtype=torch.long) for s in starts])\n"
            "    y = torch.stack([torch.tensor(token_ids[s+1:s+n+1], dtype=torch.long) for s in starts])\n"
            "    return x.to(device), y.to(device)\n"),
        _cell("code",
            "model.train(); started = time.time(); metrics_file.write_text('', encoding='utf-8')\n"
            "for step in range(1, TRAINING['max_steps'] + 1):\n"
            "    x, y = sample_batch(); optimizer.zero_grad(set_to_none=True)\n"
            "    logits = model(x)\n"
            "    if isinstance(logits, tuple): logits = logits[0]\n"
            "    if logits.ndim != 3 or logits.shape[:2] != y.shape or logits.shape[-1] <= int(y.max()):\n"
            "        raise ValueError('Model must output [batch, sequence, vocab] logits covering tokenizer IDs')\n"
            "    loss = F.cross_entropy(logits.reshape(-1, logits.shape[-1]), y.reshape(-1))\n"
            "    loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(), TRAINING['gradient_clip_norm']); optimizer.step()\n"
            "    record = {'step': step, 'loss': float(loss.detach().cpu()), 'elapsed_seconds': time.time()-started}\n"
            "    if step % TRAINING['log_every_steps'] == 0 or step == 1:\n"
            "        print(f\"step={step} loss={record['loss']:.4f} elapsed={record['elapsed_seconds']:.1f}s\")\n"
            "        with metrics_file.open('a', encoding='utf-8') as f: f.write(json.dumps(record)+'\\n')\n"
            "    if step % TRAINING['save_every_steps'] == 0 or step == TRAINING['max_steps']:\n"
            "        torch.save({'model_state_dict': model.state_dict(), 'optimizer_state_dict': optimizer.state_dict(), 'step': step, 'training': TRAINING, 'graph': GRAPH_SPEC}, out / f'checkpoint-{step}.pt')\n"
            "model.eval(); torch.save(model.state_dict(), out / 'model_state_dict.pt')\n"
            "print('Training complete. Artifacts:', out.resolve())\n"),
        _cell("markdown", "## Scope and limitations\n\nThis first workflow is for causal language modelling and requires vocabulary logits compatible with the selected tokenizer. The graph compiler only supports executable nodes; a schema-valid graph is not necessarily trainable for this task. The notebook uses CUDA only if the execution environment already provides it; ThinkNet does not provision GPUs. The API generates the notebook but does not execute it or stream live training telemetry in this milestone.")
    ]
    return {"cells": cells, "metadata": {"kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"}, "language_info": {"name": "python"}}, "nbformat": 4, "nbformat_minor": 5}

@router.post("/notebook")
def create_training_notebook(payload: NotebookRequest):
    # Lazy import avoids a circular import when the graph backend mounts this router.
    from backend.thinknet_backend_core import GraphDef, CompiledGraph, validate_graph
    try:
        graph = GraphDef.model_validate(payload.graph)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Invalid graph schema: {exc}") from exc
    errors = validate_graph(graph)
    if errors:
        raise HTTPException(status_code=400, detail={"errors": errors})
    try:
        CompiledGraph(graph)
    except Exception as exc:
        raise HTTPException(status_code=400, detail={"errors": [str(exc)]}) from exc
    notebook = build_training_notebook(graph.model_dump(mode="json"), payload.training)
    return {"generated": True, "filename": f"{graph.name or 'thinknet'}_training.ipynb", "notebook": notebook, "training": payload.training.model_dump(), "task": "causal_language_modeling", "note": "Notebook generation only; execution and live telemetry are future work."}


# Managed training-job endpoints live in their own module and are mounted by the app factory,
# so this module never imports them at import time (jobs depend on TrainingSettings from here).
def mount_job_endpoints() -> None:
    from backend.thinknet_training_jobs import router as training_jobs_router

    router.include_router(training_jobs_router)
