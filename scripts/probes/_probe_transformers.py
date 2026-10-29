import importlib
import sys

print("python", sys.version.split()[0])
print("executable", sys.executable)

try:
    import transformers
except Exception as exc:  # noqa: BLE001
    print("import transformers FAILED", type(exc).__name__, exc)
    raise SystemExit(1)

print("transformers", transformers.__version__)
print("file", transformers.__file__)
names = [n for n in dir(transformers) if "Token" in n]
print("token names:", names[:20])

for symbol in ("AutoTokenizer", "PreTrainedTokenizerBase", "AutoModel"):
    try:
        value = getattr(transformers, symbol)
        print(symbol, "->", getattr(value, "__module__", "?"))
    except Exception as exc:  # noqa: BLE001
        print(symbol, "-> ERROR", type(exc).__name__, exc)

for mod in ("tokenizers", "safetensors", "numpy", "torch"):
    try:
        m = importlib.import_module(mod) if hasattr(importlib, "import_module") else importlib.__dict__["__import__"](mod)
        print(mod, getattr(m, "__version__", "?"))
    except Exception as exc:  # noqa: BLE001
        print(mod, "ERROR", type(exc).__name__, exc)
