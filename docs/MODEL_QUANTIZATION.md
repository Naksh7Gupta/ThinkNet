# Local model quantization

ThinkNet's **Model quantization** canvas offers a local **Model Loader → Quantizer → Output** workflow for supported Hugging Face model directories and checkpoint files. It is separate from the existing in-memory `Quantizer` operation for compiled ThinkNet graphs.

## Supported input and conversions

- Input must include a local Transformers `config.json` and supported model weights. Safetensors files and sharded `model.safetensors.index.json` checkpoints are supported. Tensor-only PyTorch state dictionaries in `.pt`, `.pth`, `.bin`, or `.ckpt` files are also supported, including indexed `pytorch_model.bin` shards. A checkpoint file can be selected directly when it is beside its `config.json`.
- PyTorch files are opened with `torch.load(..., weights_only=True)`; pickled model objects, optimizer/training bundles, legacy unrestricted-pickle checkpoints, and state dictionaries that do not exactly match the configured model are rejected. Remote model identifiers and architectures that cannot be loaded by the installed Transformers `AutoModel`/`AutoModelForCausalLM` classes are rejected. Remote code is never trusted or downloaded.
- FP16 and BF16 are supported. The backend loads the checkpoint on CPU, converts floating tensors, and saves a new safetensors model directory. INT8, INT4, GPTQ, AWQ, and GGUF are not implemented by this local checkpoint workflow.
- The source directory is never used as an output. Existing output directories are never overwritten.
- Before loading, ThinkNet estimates available RAM and destination disk requirements. A conversion is rejected when those checks fail; these conservative estimates cannot guarantee against OS-level memory pressure from other processes.
- Completion means the output configuration and safetensors headers were reopened and the output tensor count and converted floating-tensor dtypes were verified. It is not a benchmark or an inference-quality test.
- The size estimate in the Quantizer step comes from ThinkNet's reusable `@thinknet/compute-estimator` package and covers model weights only. The completion report uses measured directory sizes, including saved config and copied tokenizer/processor files.
- The designer's left rail also has a **Compute Estimator** panel. Choose an inspected Model Loader input or a validated local asset and a target precision to see the package's estimated weight-storage size. This is not a conversion and does not estimate runtime memory, activations, latency, or hardware feasibility.
- The same panel can estimate parameter storage for the designed tensor graph and supported architecture nodes on the canvas. If the graph includes a node whose parameters cannot be determined from its configuration (for example, an uninitialized `AutoLinear`), the panel labels the result as a partial known-parameter subtotal and identifies the unestimated nodes.

## Use in the desktop app

1. Select **Model quantization** above the visual canvas.
2. In **Model Loader**, browse to a local model directory or select a `.safetensors`, `.pt`, `.pth`, `.bin`, or `.ckpt` checkpoint. Directly selected checkpoint files require a neighboring `config.json`. ThinkNet inspects the format, architecture, tensor parameter count, dtypes, and current model directory size.
3. In **Quantizer**, choose FP16 or BF16.
4. In **Output**, choose an existing destination folder and provide a new folder name.
5. Start conversion and follow the backend job phase and progress. On success, the Output node reports format, measured size, size change, and validation status. A failed job displays its backend error and does not report success.

Local model browsing uses the Electron file/folder picker. When running the renderer as a web page, local filesystem selection is unavailable; use the ThinkNet desktop app.

## Backend API

- `POST /api/v1/local-models/inspect` with `{"model_path":"<local-directory-or-checkpoint-file>"}` returns model metadata or a validation error.
- `POST /api/v1/local-models/quantization-jobs` accepts `model_path`, `output_directory`, `output_name`, and `dtype` (`float16` or `bfloat16`). It validates the request and starts a local background job.
- `GET /api/v1/local-models/quantization-jobs/{job_id}` returns `queued`, `running`, `completed`, or `failed` status and the final measured output report.

Jobs are held in backend memory and do not survive a backend restart. Only one local conversion is allowed at a time to avoid overlapping high-memory operations.
