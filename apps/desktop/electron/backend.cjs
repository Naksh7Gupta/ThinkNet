"use strict";
/**
 * Backend supervisor: reuse a ThinkNet API that is already up, otherwise start one
 * from the plan in config.cjs and wait for /health. Torch takes a few seconds to
 * import, so the window is shown first and progress is published to the renderer.
 */
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");

const HEALTH_TIMEOUT_MS = 1500;
const POLL_INTERVAL_MS = 700;
const STARTUP_BUDGET_MS = Number(process.env.THINKNET_BACKEND_TIMEOUT || 120000);
const LOG_TAIL_LINES = 40;

function requestHealth(url) {
  return new Promise((resolve) => {
    const request = http.get(`${url}/health`, { timeout: HEALTH_TIMEOUT_MS }, (response) => {
      response.resume();
      resolve(response.statusCode >= 200 && response.statusCode < 300);
    });
    request.on("timeout", () => request.destroy());
    request.on("error", () => resolve(false));
  });
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForHealth(url, budgetMs) {
  const deadline = Date.now() + budgetMs;
  while (Date.now() < deadline) {
    if (await requestHealth(url)) return true;
    await delay(POLL_INTERVAL_MS);
  }
  return false;
}

class BackendSupervisor {
  /**
   * @param {object} options
   * @param {object} options.plan      result of buildBackendPlan()
   * @param {string} options.logPath   file collecting the backend's own output
   * @param {string} options.uiOrigin  origin the renderer will call from (CORS)
   * @param {(status: object) => void} options.onStatus
   */
  constructor({ plan, logPath, uiOrigin, onStatus }) {
    this.plan = plan;
    this.logPath = logPath;
    this.uiOrigin = uiOrigin;
    this.publish = typeof onStatus === "function" ? onStatus : () => {};
    this.child = null;
    this.tail = [];
    this.stopping = false;
  }

  get url() {
    return `http://${this.plan.host}:${this.plan.port}`;
  }

  log(line) {
    const text = String(line).trimEnd();
    if (!text) return;
    this.tail.push(text);
    if (this.tail.length > LOG_TAIL_LINES) this.tail.shift();
    try {
      fs.appendFileSync(this.logPath, `[${new Date().toISOString()}] ${text}\n`);
    } catch {
      // A missing log file must never take the app down.
    }
  }

  /** @returns {Promise<{state: string, url: string, message?: string, log?: string}>} */
  async ensure() {
    const { plan } = this;
    // A restart reuses this instance, so clear the flag set by stop() first.
    this.stopping = false;
    if (await requestHealth(this.url)) {
      this.log(`reusing backend already listening on ${this.url}`);
      return this.report("ready", this.url, "Connected to a backend that was already running.", { reused: true });
    }

    if (plan.kind === null) {
      return this.report("unavailable", this.url, plan.reason, { log: this.logPath });
    }

    this.publish({ state: "starting", url: this.url, message: `Starting the local backend (${plan.label})…` });
    this.log(`spawning ${plan.command} ${plan.args.join(" ")}`);

    try {
      this.child = spawn(plan.command, plan.args, {
        cwd: plan.cwd,
        windowsHide: true,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: "1",
          // The renderer is served from its own loopback port; teach CORS about it.
          THINKNET_EXTRA_ORIGINS: this.uiOrigin,
        },
      });
    } catch (error) {
      return this.report("failed", this.url, `Could not launch the backend: ${error.message}`);
    }

    this.child.stdout.setEncoding("utf8");
    this.child.stderr.setEncoding("utf8");
    this.child.stdout.on("data", (chunk) => chunk.split("\n").forEach((line) => this.log(line)));
    this.child.stderr.on("data", (chunk) => chunk.split("\n").forEach((line) => this.log(line)));
    this.child.on("error", (error) => {
      this.child = null;
      this.report("failed", this.url, `Backend process error: ${error.message}`);
    });
    this.child.on("exit", (code, signal) => {
      this.log(`backend exited (code ${code}, signal ${signal})`);
      this.child = null;
      if (this.stopping) return;
      this.report("failed", this.url, `The backend stopped before it was ready (exit ${code}).`, {
        log: this.logPath,
        tail: this.tail.slice(-6),
      });
    });

    if (await waitForHealth(this.url, STARTUP_BUDGET_MS)) {
      return this.report("ready", this.url, "Local backend is up.", { started: true });
    }
    return this.report(
      "failed",
      this.url,
      `The backend did not answer /health within ${Math.round(STARTUP_BUDGET_MS / 1000)}s.`,
      { log: this.logPath, tail: this.tail.slice(-6) },
    );
  }

  report(state, url, message, extra = {}) {
    const status = { state, url, message, ...extra };
    this.publish(status);
    return status;
  }

  async stop() {
    const child = this.child;
    if (!child) return;
    this.stopping = true;
    this.log("stopping the backend we started");
    await new Promise((resolve) => {
      const done = () => resolve();
      child.once("exit", done);
      if (process.platform === "win32") {
        // uvicorn spawns no children today, but /T keeps this correct if that changes.
        spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
      } else {
        child.kill("SIGTERM");
        setTimeout(() => child.exitCode === null && child.kill("SIGKILL"), 4000);
      }
      setTimeout(done, 6000);
    });
    this.child = null;
  }
}

/** Default log location: <userData>/logs/backend.log — see main.cjs for the path. */
function ensureLogFile(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "backend.log");
}

module.exports = { BackendSupervisor, ensureLogFile, requestHealth, waitForHealth };
