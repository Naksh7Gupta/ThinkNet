"""Confirm the failure signature and how long the race window is."""
import sys
import time
import types

VENV_INIT = (
    r"C:\Users\hp\Desktop\Projects\ThinkNet\backend\.venv\Lib\site-packages\transformers\__init__.py"
)

# 1. Signature: a module present in sys.modules but not finished executing.
half = types.ModuleType("transformers")
half.__file__ = VENV_INIT
half.__path__ = []
sys.modules["transformers"] = half
try:
    from transformers import AutoTokenizer  # noqa: F401
    print("signature check: unexpectedly imported")
except ImportError as exc:
    print("signature:", exc)
finally:
    del sys.modules["transformers"]

# 2. How long is the window in this venv?
start = time.perf_counter() if hasattr(time, "perf_counter") else time.time()
import transformers  # noqa: F401
print(f"first transformers import: {time.perf_counter() - start:.1f}s")
