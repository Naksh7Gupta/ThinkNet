# ThinkNet Frontend

Desktop architecture editor for the current ThinkNet backend. The UI only exposes operations the Python API actually implements.

## Stack

Tauri v2, React, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Flow, Zustand, TanStack Query.

## Run

Start the backend from the repository root (with the backend virtualenv active):

```bash
uvicorn backend.thinknet_backend_core:app --reload
```

Then, in another terminal:

```bash
cd frontend
npm install
npm run dev
```

The Vite app is at `http://localhost:1420` and talks to `http://127.0.0.1:8000` unless `VITE_API_BASE_URL` is set.

Desktop shell (requires Rust / Cargo):

```bash
cd frontend
npm run tauri dev
```

## Checks

```bash
cd frontend
npm run typecheck
npm run lint
npm test
npm run build
```
