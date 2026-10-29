"""Reproduce the AutoTokenizer import failure seen in the Train tab."""
import sys
import threading
import traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

# The backend imports torch and the graph core on the main thread before any job runs.
import torch  # noqa: F401,E402
import services.backend.thinknet_backend_core  # noqa: F401,E402

results = {}


def worker(index):
    try:
        from transformers import AutoTokenizer

        results[index] = "ok " + AutoTokenizer.__module__
    except BaseException as exc:  # noqa: BLE001
        results[index] = f"{type(exc).__name__}: {exc}"


for attempt in range(4):
    results.clear()
    threads = [threading.Thread(target=worker, args=(i,)) for i in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    distinct = sorted(set(results.values()))
    print(f"attempt {attempt}: {distinct}")
    if any(not value.startswith("ok") for value in results.values()):
        print("REPRODUCED")
        break
else:
    print("not reproduced with 4 threads")

# Second scenario: import inside an active circular-ish path (fresh module state impossible here).
try:
    from transformers import AutoTokenizer

    print("sequential import after threads: ok")
except BaseException as exc:  # noqa: BLE001
    print("sequential import failed:", type(exc).__name__, exc)
    traceback.print_exc(limit=5)
