"use strict";
/**
 * The only bridge between the renderer and the desktop shell: a read-only copy of
 * where the backend lives plus a status channel. No node, no fs in the page.
 */
const { contextBridge, ipcRenderer } = require("electron");

function flag(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((argument) => argument.startsWith(prefix));
  return hit ? hit.slice(prefix.length).replace(/\/+$/, "") : "";
}

contextBridge.exposeInMainWorld("thinknet", {
  desktop: true,
  platform: process.platform,
  /** Injected by the main process; empty when the page runs outside Electron. */
  apiBase: flag("thinknet-api-base"),
  uiOrigin: flag("thinknet-ui-origin"),
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  getStatus: () => ipcRenderer.invoke("thinknet:get-status"),
  restartBackend: () => ipcRenderer.invoke("thinknet:restart-backend"),
  openLogFile: () => ipcRenderer.invoke("thinknet:open-log"),
  selectModelInput: () => ipcRenderer.invoke("thinknet:select-model-input"),
  selectOutputDirectory: () => ipcRenderer.invoke("thinknet:select-output-directory"),
  minimizeWindow: () => ipcRenderer.invoke("thinknet:minimize-window"),
  toggleWindowMaximize: () => ipcRenderer.invoke("thinknet:toggle-maximize-window"),
  closeWindow: () => ipcRenderer.invoke("thinknet:close-window"),
  onStatus: (callback) => {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("thinknet:status", listener);
    return () => ipcRenderer.removeListener("thinknet:status", listener);
  },
});
