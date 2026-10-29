"use strict";
/**
 * Tiny static file server for the built renderer, so the packaged app loads
 * http://127.0.0.1:<port>/ instead of a file:// page. A real http(s) origin keeps
 * the backend's CORS allow-list boring and gives the app a stable origin string.
 * No dependencies: node's http plus a mime table is all a Vite bundle needs.
 */
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const MIME = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".mjs": "application/javascript; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function contentType(file) {
  return MIME[path.extname(file).toLowerCase()] || "application/octet-stream";
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Cache-Control": "no-store", ...headers });
  res.end(body);
}

function handlerFor(root) {
  return function handle(request, response) {
    let pathname = "/";
    try {
      pathname = decodeURIComponentSafe(request.url) || "/";
    } catch {
      return send(response, 400, "Bad request");
    }

    const requested = path.join(root, path.normalize(pathname).replace(/^([/\\])+/, ""));
    // Everything must resolve inside the dist folder, never above it.
    if (requested !== root && !requested.startsWith(root + path.sep)) {
      return send(response, 403, "Forbidden");
    }

    let target = requested;
    try {
      if (fs.statSync(target).isDirectory()) target = path.join(target, "index.html");
    } catch {
      // SPA routes have no file on disk; index.html answers them.
      if (path.extname(target)) return send(response, 404, "Not found");
      target = path.join(root, "index.html");
    }

    fs.readFile(target, (error, data) => {
      if (error) return send(response, 404, "Not found");
      send(response, 200, data, { "Content-Type": contentType(target) });
    });
  };
}

function decodeURIComponentSafe(raw) {
  const withoutQuery = String(raw).split("?")[0].split("#")[0];
  try {
    return decodeURIComponent(withoutQuery);
  } catch {
    return withoutQuery;
  }
}

/**
 * Listens on 127.0.0.1 only. Falls back to an ephemeral port when the preferred
 * one is taken (a second window of the same app is blocked elsewhere by the
 * single-instance lock, so this is about other software, not about us).
 */
function startStaticServer(root, preferredPort) {
  const absolute = path.resolve(root);
  const server = http.createServer(handlerFor(absolute));
  const tryPort = (port) =>
    new Promise((resolve, reject) => {
      const onError = (error) => {
        server.removeListener("listening", onListening);
        if (error && error.code === "EADDRINUSE" && port !== 0) return resolve(tryPort(0));
        reject(error);
      };
      const onListening = () => {
        server.removeListener("error", onError);
        resolve({
          port: server.address().port,
          origin: `http://127.0.0.1:${server.address().port}`,
          close: () => new Promise((done) => server.close(() => done())),
        });
      };
      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(port, "127.0.0.1");
    });
  return tryPort(preferredPort);
}

module.exports = { handlerFor, startStaticServer };
