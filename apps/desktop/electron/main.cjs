"use strict";
/**
 * ThinkNet desktop entry point.
 *
 * One process tree, three parts: a static server for the built renderer, the
 * FastAPI backend (started by electron/backend.cjs unless one is already running),
 * and a Chromium window. Losing the window takes the backend with it, so nothing
 * keeps listening on 127.0.0.1 after quit.
 */
const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require("electron");

const { buildBackendPlan, UI_PORT } = require("./config.cjs");
const { startStaticServer } = require("./server.cjs");
const { BackendSupervisor, ensureLogFile } = require("./backend.cjs");

const IS_WINDOWS = process.platform === "win32";
const DEV_URL = process.env.THINKNET_DEV_URL || "";
const DIST_DIR = path.join(__dirname, "..", "dist");

let window = null;
let server = null;
let supervisor = null;
let logPath = "";
let status = { state: "starting", message: "Starting ThinkNet…" };
let quitting = false;

function publish(next) {
  status = { ...next, at: new Date().toISOString() };
  if (!window || window.isDestroyed()) return;
  try {
    // send() is synchronous and returns a boolean, not a promise.
    window.webContents.send("thinknet:status", status);
  } catch {
    // The window can close between the check and the send.
  }
}

function iconPath() {
  const file = IS_WINDOWS ? "icon.ico" : "icon.png";
  const candidate = path.join(__dirname, "..", "build", file);
  return fs.existsSync(candidate) ? candidate : undefined;
}

/** Where the renderer is served from: vite while developing, our own port otherwise. */
function uiOrigin() {
  return DEV_URL || (server && server.origin) || "";
}

function backendLabel() {
  return (supervisor && supervisor.url) || status.url || "not started";
}

function showError(message, detail) {
  dialog.showMessageBoxSync({
    type: "error",
    title: "ThinkNet",
    message,
    detail,
    buttons: ["OK"],
  });
}

function buildMenu() {
  // Keep the desktop shell free of the native app header/menu chrome. The UI
  // already provides its own navigation and actions, and the main window should
  // render edge-to-edge without the Electron menu strip.
  Menu.setApplicationMenu(null);
}

function createWindow() {
  const apiBase = backendLabel().replace(/\/+$/, "");
  const origin = uiOrigin();

  window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    title: "ThinkNet",
    frame: false,
    autoHideMenuBar: true,
    titleBarStyle: "hidden",
    icon: iconPath(),
    backgroundColor: "#14161C",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      // The preload only needs ipcRenderer + contextBridge, but keeping the
      // sandbox off lets it read the injected command-line flags reliably.
      sandbox: false,
      additionalArguments: [`--thinknet-api-base=${apiBase}`, `--thinknet-ui-origin=${origin}`],
    },
  });

  window.once("ready-to-show", () => window.show());
  window.on("closed", () => {
    window = null;
  });

  // Target="_blank" and window.open go to the real browser, never a new app window.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  // Exported model.py should ask where to save, like any desktop app.
  window.webContents.session.on("will-download", (_event, item) => {
    const suggested = path.join(app.getPath("downloads"), item.getFilename() || "thinknet-export");
    const target = dialog.showSaveDialogSync(window, { title: "Save export", defaultPath: suggested });
    if (target) item.setSavePath(target);
    else item.cancel();
  });

  const entryUrl = DEV_URL || `${origin}/index.html`;
  window.loadURL(entryUrl).catch((error) => {
    showError(
      "The interface failed to load.",
      `${entryUrl}\n${error.message}\n\nFor a packaged build, apps/desktop/dist must exist (npm run build).`,
    );
    app.quit();
  });
}

function focusWindow() {
  if (!window || window.isDestroyed()) return createWindow();
  if (window.isMinimized()) window.restore();
  window.focus();
}

async function launch() {
  app.setAppUserModelId("com.thinknet.desktop");
  buildMenu();

  logPath = ensureLogFile(path.join(app.getPath("userData"), "logs"));
  const plan = buildBackendPlan({
    appPath: app.getAppPath(),
    execPath: process.execPath,
    resourcesPath: process.resourcesPath,
  });

  if (!DEV_URL) {
    const index = path.join(DIST_DIR, "index.html");
    if (!fs.existsSync(index)) {
      showError(
        "No built interface found.",
        `Expected ${index}.\n\nRun "npm run build" from the repository root, or use "npm run electron:dev".`,
      );
      app.quit();
      return;
    }
    server = await startStaticServer(DIST_DIR, UI_PORT);
  }

  supervisor = new BackendSupervisor({
    plan,
    logPath,
    uiOrigin: uiOrigin() || "http://localhost:1420",
    onStatus: publish,
  });

  createWindow();
  // The window is already useful; torch imports in the background.
  supervisor.ensure().catch((error) => publish({ state: "failed", url: backendLabel(), message: error.message }));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", focusWindow);
  app.on("web-contents-created", (_event, contents) => {
    if (contents.getType() !== "window") return;
    // The single navigation guard: the app may only move inside its own origin.
    contents.on("will-navigate", (event, url) => {
      if (/^devtools:/.test(url)) return;
      const allowed = [DEV_URL, server && server.origin].filter(Boolean);
      if (allowed.some((origin) => url.startsWith(origin))) return;
      event.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    });
  });
  app.whenReady().then(launch).catch((error) => {
    showError("Startup failed.", error.stack || error.message);
    app.quit();
  });

  app.on("window-all-closed", () => app.quit());
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) focusWindow();
  });

  // The renderer asks for the same status the menu shows, and can retry on demand.
  ipcMain.handle("thinknet:get-status", () => status);
  ipcMain.handle("thinknet:minimize-window", () => {
    if (window && !window.isDestroyed()) window.minimize();
    return true;
  });
  ipcMain.handle("thinknet:toggle-maximize-window", () => {
    if (!window || window.isDestroyed()) return false;
    if (window.isMaximized()) window.unmaximize();
    else window.maximize();
    return true;
  });
  ipcMain.handle("thinknet:close-window", () => {
    if (window && !window.isDestroyed()) window.close();
    return true;
  });
  ipcMain.handle("thinknet:restart-backend", async () => {
    if (!supervisor) return status;
    await supervisor.stop();
    return supervisor.ensure();
  });
  ipcMain.handle("thinknet:open-log", () => (logPath ? shell.openPath(logPath) : "No log file yet."));

  app.on("before-quit", (event) => {
    // Only stop what we started: a backend the user launched themselves stays theirs.
    const ownsBackend = !!(supervisor && supervisor.child);
    if (quitting || (!ownsBackend && !server)) return;
    event.preventDefault();
    quitting = true;
    const finish = async () => {
      if (ownsBackend) await supervisor.stop().catch(() => {});
      if (server) await server.close().catch(() => {});
      app.exit(0);
    };
    finish();
    // Never let a wedged child process keep the app alive forever.
    setTimeout(() => app.exit(0), 8000);
  });
}
