"use strict";
/**
 * Locates the pieces the desktop app needs: the FastAPI backend source, a Python
 * interpreter that can run it, and where the built renderer lives.
 *
 * Deliberately free of any `electron` import so the resolution order can be
 * smoke-tested with plain node (`node electron/config.cjs --explain`).
 */
const fs = require("node:fs");
const path = require("node:path");

const BACKEND_APP = "backend.thinknet_backend_core:app";
const BACKEND_MODULE = "uvicorn";
const BACKEND_HOST = "127.0.0.1";
const CONFIG_FILES = ["thinknet.desktop.json"];
const BACKEND_MARKER = path.join("backend", "thinknet_backend_core.py");
const IS_WINDOWS = process.platform === "win32";

function portFromEnv(name, fallback) {
  const raw = Number(process.env[name]);
  return Number.isInteger(raw) && raw > 0 && raw < 65536 ? raw : fallback;
}

const BACKEND_PORT = portFromEnv("THINKNET_BACKEND_PORT", 8000);
const UI_PORT = portFromEnv("THINKNET_UI_PORT", 4310);

function exists(target) {
  try {
    return !!target && fs.existsSync(target);
  } catch {
    return false;
  }
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

/** `dir`, its parent, grandparent, ... — shallowest first. */
function selfAndParents(start, depth) {
  const out = [];
  let current = start;
  for (let i = 0; i < depth && current; i += 1) {
    out.push(current);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return out;
}

const isBackendRoot = (dir) => exists(path.join(dir || "", BACKEND_MARKER));

/**
 * Repo roots in the order a desktop user is most likely to mean them: explicit
 * env, a json file beside the executable, a backend bundled into the package, the
 * dev tree the app is running inside, then the working directory's ancestors.
 */
function backendRootCandidates(options = {}) {
  const env = options.env || process.env;
  const { appPath, execPath, resourcesPath, cwd } = options;
  const candidates = [];

  if (env.THINKNET_REPO_ROOT) candidates.push({ dir: env.THINKNET_REPO_ROOT, source: "THINKNET_REPO_ROOT" });

  // The portable target re-launches from a temp extraction dir, so the folder the user
  // actually ran the .exe from is only reachable through the launcher's env var.
  const configDirs = [
    execPath && path.dirname(execPath),
    appPath,
    env.PORTABLE_EXECUTABLE_DIR,
  ].filter(Boolean);
  for (const dir of configDirs) {
    for (const file of CONFIG_FILES) {
      const config = readJson(path.join(dir, file));
      if (config && typeof config.repoRoot === "string") {
        candidates.push({ dir: config.repoRoot, source: path.join(dir, file) });
      }
    }
  }

  if (resourcesPath) candidates.push({ dir: resourcesPath, source: "bundled resources" });
  if (appPath) {
    candidates.push({ dir: appPath, source: "app path" });
    candidates.push({ dir: path.join(appPath, ".."), source: "app path parent" });
    candidates.push({ dir: path.join(appPath, "..", ".."), source: "app path grandparent" });
  }
  for (const dir of selfAndParents(cwd || process.cwd(), 4)) {
    candidates.push({ dir, source: "working directory" });
  }

  return candidates.map((entry) => ({ ...entry, dir: path.resolve(entry.dir) }));
}

function resolveBackendRoot(options = {}) {
  const hit = backendRootCandidates(options).find((entry) => isBackendRoot(entry.dir));
  return hit || null;
}

/** venv shipped with the repo, the interpreter from a bundled runtime, then $PYTHON. */
function resolveInterpreter(root, options = {}) {
  const env = options.env || process.env;
  const candidates = [];
  if (env.THINKNET_PYTHON) candidates.push({ path: env.THINKNET_PYTHON, source: "THINKNET_PYTHON" });
  if (root) {
    candidates.push({
      path: path.join(root, "backend", ".venv", IS_WINDOWS ? "Scripts" : "bin", IS_WINDOWS ? "python.exe" : "python"),
      source: "backend/.venv",
    });
    candidates.push({
      path: path.join(root, "backend", ".venv", IS_WINDOWS ? "Scripts" : "bin", "python3"),
      source: "backend/.venv",
    });
  }
  if (options.resourcesPath) {
    candidates.push({
      path: path.join(options.resourcesPath, "python", IS_WINDOWS ? "python.exe" : "bin/python"),
      source: "bundled python",
    });
  }
  if (env.THINKNET_ALLOW_SYSTEM_PYTHON === "1") {
    candidates.push({ path: IS_WINDOWS ? "python" : "python3", source: "PATH", trustPath: true });
  }
  return candidates.find((entry) => entry.trustPath || exists(entry.path)) || null;
}

/** A frozen `thinknet-backend.exe` next to the app needs no interpreter at all. */
function resolveFrozenBackend(options = {}) {
  const env = options.env || process.env;
  const names = IS_WINDOWS ? ["thinknet-backend.exe"] : ["thinknet-backend"];
  const dirs = [
    env.THINKNET_BACKEND_EXE,
    options.resourcesPath,
    options.execPath && path.dirname(options.execPath),
    env.PORTABLE_EXECUTABLE_DIR,
  ].filter(Boolean);
  for (const dir of dirs) {
    const file = path.isAbsolute(dir) && names.includes(path.basename(dir)) ? dir : path.join(dir, names[0]);
    if (exists(file)) return { path: file, dir: path.dirname(file), source: "frozen backend" };
  }
  return null;
}

/**
 * Everything the supervisor needs to launch a backend, or why it cannot.
 * `kind` is "module" (python -m uvicorn), "exe" (frozen backend) or null.
 */
function buildBackendPlan(options = {}) {
  const env = options.env || process.env;
  const host = options.host || env.THINKNET_BACKEND_HOST || BACKEND_HOST;
  const port = options.port || BACKEND_PORT;

  const frozen = resolveFrozenBackend(options);
  if (frozen) {
    return {
      kind: "exe",
      host,
      port,
      command: frozen.path,
      args: ["--host", host, "--port", String(port)],
      cwd: frozen.dir,
      root: frozen.dir,
      label: `${frozen.path} (frozen)`,
    };
  }

  const rootHit = resolveBackendRoot(options);
  if (!rootHit) {
    return {
      kind: null,
      host,
      port,
      reason:
        "No ThinkNet backend found next to this app. Set THINKNET_REPO_ROOT to the repository " +
        "folder, put a thinknet.desktop.json with {\"repoRoot\": \"...\"} next to the executable, " +
        "or start the backend yourself and the app will connect to it.",
    };
  }

  const interpreter = resolveInterpreter(rootHit.dir, options);
  if (!interpreter) {
    return {
      kind: null,
      host,
      port,
      root: rootHit.dir,
      reason: `Found the backend at ${rootHit.dir} but no Python interpreter. Create backend/.venv or set THINKNET_PYTHON.`,
    };
  }

  return {
    kind: "module",
    host,
    port,
    command: interpreter.path,
    args: ["-m", BACKEND_MODULE, BACKEND_APP, "--host", host, "--port", String(port)],
    cwd: rootHit.dir,
    root: rootHit.dir,
    label: `${interpreter.source} · ${rootHit.dir}`,
  };
}

function backendUrl(plan) {
  return `http://${(plan && plan.host) || BACKEND_HOST}:${(plan && plan.port) || BACKEND_PORT}`;
}

function explain() {
  const plan = buildBackendPlan({
    appPath: process.cwd(),
    execPath: process.execPath,
    resourcesPath: process.resourcesPath,
  });
  console.log(JSON.stringify({ plan, candidates: backendRootCandidates({ appPath: process.cwd() }) }, null, 2));
}

module.exports = {
  BACKEND_APP,
  BACKEND_HOST,
  BACKEND_PORT,
  UI_PORT,
  backendRootCandidates,
  backendUrl,
  buildBackendPlan,
  resolveBackendRoot,
  resolveFrozenBackend,
  resolveInterpreter,
};

if (require.main === module && process.argv.includes("--explain")) explain();
