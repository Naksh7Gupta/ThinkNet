# ThinkNet Desktop App

Desktop architecture editor for the ThinkNet backend. The UI only exposes operations the Python API actually implements.

## Stack

Electron, React, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Flow, Zustand, TanStack Query.

## Run

From the repository root, install the JavaScript workspace dependencies:

```bash
npm install
```

Run the API from the repository root after installing `services/backend/requirements.txt`:

```bash
python -m uvicorn services.backend.thinknet_backend_core:app --reload
```

Run the desktop UI from the repository root:

```bash
npm run dev
```

The Vite app is at `http://localhost:1420` and talks to `http://127.0.0.1:8000` unless `VITE_API_BASE_URL` is set.

## Desktop app (Electron)

The Electron shell is the desktop app. It bundles the built UI, serves it from a
loopback port, and starts the FastAPI backend for you.

```bash
npm run electron:build      # vite build + electron-builder -> apps/desktop/release/
```

Run it without packaging:

```bash
npm run electron:dev        # attaches to vite on :1420 (starts vite if it is not up)
npm run electron:start      # runs the built dist/ in a window
```

What the shell does on launch (`electron/main.cjs`):

1. Serves `dist/` from `http://127.0.0.1:4310` (falls back to a free port). A real
   http origin is used instead of `file://` so the backend CORS allow-list stays an
   allow-list.
2. Looks for a backend already answering `http://127.0.0.1:8000/health` and reuses it
   if present. Otherwise it starts one and waits for `/health` (torch imports slowly,
   so the window appears first and the header pill shows *Starting local backend*).
3. On quit it stops only the backend it started — a server you launched yourself is
   left alone.

Backend resolution order (`electron/config.cjs`, run `node electron/config.cjs --explain`
to see the decision):

1. `THINKNET_BACKEND_EXE` / a `thinknet-backend.exe` in resources, next to the app, or next to
   the portable `.exe`
2. `THINKNET_REPO_ROOT`, or a `thinknet.desktop.json` next to the executable
3. The repository this app is running inside (`services/backend/thinknet_backend_core.py` marker)
4. Interpreter: `THINKNET_PYTHON` → `services/backend/.venv` → bundled `resources/python`
   (`python` on PATH only if `THINKNET_ALLOW_SYSTEM_PYTHON=1`)

A portable `.exe` executes from a temp folder, so candidate 3 cannot reach your checkout on its
own. Put a `thinknet.desktop.json` next to the `.exe` (the launcher's `PORTABLE_EXECUTABLE_DIR`
is honoured) and it will find the repo from anywhere:

```json
{ "repoRoot": "C:\\Users\\hp\\Desktop\\Projects\\ThinkNet" }
```

If nothing is found the app still opens and reports *Backend stopped* with the reason;
File → Restart local backend retries, and File → Open backend log shows the backend's
own output.

Environment knobs: `THINKNET_BACKEND_PORT`, `THINKNET_UI_PORT`, `THINKNET_DEV_URL`,
`THINKNET_BACKEND_TIMEOUT`, `THINKNET_EXTRA_ORIGINS` (read by the backend to widen CORS).

Outputs land in `apps/desktop/release/`: a portable `.exe` and an NSIS `Setup.exe`. Note that the backend still needs a Python environment with torch — packaging the Python
runtime (PyInstaller → `thinknet-backend.exe`) is the planned follow-up for machines
without the repo.

## Checks

```bash
npm run typecheck
npm run lint
npm run test:frontend
npm run build
```
