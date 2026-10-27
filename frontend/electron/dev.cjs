"use strict";
/**
 * Development runner for the desktop shell:
 *   npm run electron:dev
 *
 * It never assumes it owns port 1420. If vite is already running (the common case
 * while developing the web app), the window simply attaches to it; otherwise this
 * starts vite and shuts it down again on exit.
 */
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");

const IS_WINDOWS = process.platform === "win32";
const DEV_URL = process.env.DEV_URL || "http://localhost:1420";
const ELECTRON = path.join(__dirname, "..", "node_modules", "electron", "cli.js");

function probe(url) {
  return new Promise((resolve) => {
    const request = http.get(url, { timeout: 1200 }, (response) => {
      response.resume();
      resolve(response.statusCode < 500);
    });
    request.on("timeout", () => request.destroy());
    request.on("error", () => resolve(false));
  });
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForDevServer(url, attempts = 60) {
  for (let i = 0; i < attempts; i += 1) {
    if (await probe(url)) return true;
    await delay(1000);
  }
  return false;
}

function run(command, args, options = {}) {
  const { env = {}, shell = false } = options;
  return spawn(command, args, {
    cwd: path.join(__dirname, ".."),
    stdio: "inherit",
    windowsHide: true,
    // Windows needs a shell for npm (npm.cmd), and Node refuses .cmd without one.
    shell,
    env: { ...process.env, ...env },
  });
}

async function main() {
  const started = [];
  let shuttingDown = false;

  const shutdown = (code) => {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const entry of started.reverse()) {
      if (entry.dead) continue;
      try {
        if (IS_WINDOWS && entry.shell) {
          // Killing the shell alone would leave vite and electron running.
          spawn("taskkill", ["/pid", String(entry.child.pid), "/T", "/F"], { windowsHide: true });
        } else {
          entry.child.kill();
        }
      } catch {
        // Already gone.
      }
    }
    process.exit(code);
  };

  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));

  let devUrl = DEV_URL;
  if (await probe(devUrl)) {
    console.log(`[electron:dev] using the vite server already running on ${devUrl}`);
  } else {
    console.log(`[electron:dev] starting vite on ${devUrl}`);
    started.push({ child: run("npm", ["run", "dev"], { shell: IS_WINDOWS }), shell: IS_WINDOWS });
    if (!(await waitForDevServer(devUrl))) {
      console.error("[electron:dev] vite did not answer in time; opening the window anyway.");
    }
  }

  const electron = run(process.execPath, [ELECTRON, "."], { env: { THINKNET_DEV_URL: devUrl } });
  started.push({ child: electron, shell: false });
  electron.on("exit", (_code, signal) => {
    if (signal) return; // we killed it ourselves
    shutdown(0);
  });
}

main().catch((error) => {
  console.error("[electron:dev]", error);
  process.exit(1);
});
