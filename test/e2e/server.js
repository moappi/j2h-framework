"use strict";

/**
 * Minimal static file server used by the browser end-to-end suite.
 *
 * Deliberately dependency-free (no express) so it has nothing extra to
 * install. It serves:
 *   - /                 -> test/e2e/fixtures/index.html (the example app,
 *                          copied from examples/client/index.html but
 *                          pointing at locally-vendored libraries instead of
 *                          a CDN)
 *   - /unit             -> test/e2e/fixtures/unit.html (a bare page that
 *                          loads only page.js + json2html.js + j2h.js, for
 *                          directly exercising individual j2h.* classes)
 *   - /js/j2h.js        -> the REAL, current framework source at the repo
 *                          root (../../j2h.js) - not a copy - so this suite
 *                          always tests whatever the source currently says,
 *                          never a stale snapshot.
 *   - /vendor/*         -> real page.js / json2html.js browser builds,
 *                          vendored from their GitHub sources (see
 *                          test/e2e/vendor/README.md) since the example's
 *                          original CDN links aren't reachable in CI/sandbox
 *                          environments with restricted network access.
 *   - /lib/*, /pages/*, /components/* -> served directly from
 *                          examples/client/ - the REAL, unmodified example
 *                          app files - so this suite exercises the actual
 *                          example, not a reimplementation of it.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.join(__dirname, "..", "..");
const EXAMPLE_DIR = path.join(REPO_ROOT, "examples", "client");
const FIXTURES_DIR = path.join(__dirname, "fixtures");
const VENDOR_DIR = path.join(__dirname, "vendor");

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8"
};

function sendFile(res, filePath) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("Not found: " + filePath);
            return;
        }
        res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
        res.end(data);
    });
}

// On-the-fly script generator used by the Module#load() end-to-end tests.
// Any request under /e2e/ gets back a tiny real JS file that calls
// `window.j2h.export(<its own exact request path>, <a derived value>)` -
// this lets tests drive REAL network script loading (real 'load' events,
// real timing) instead of stubbing it, while still being able to predict
// the exported value. An optional `?delay=N` query param delays the
// response by N ms, used to test the readyState-guard fix against a
// still-in-flight request.
function serveE2EScript(req, res) {
    let fullPath = req.url; // preserve the exact path+query used as the `src`
    let qs = fullPath.indexOf("?") >= 0 ? fullPath.slice(fullPath.indexOf("?") + 1) : "";
    let delayMatch = qs.match(/delay=(\d+)/);
    let delay = delayMatch ? parseInt(delayMatch[1], 10) : 0;
    let body = "window.j2h.export(" + JSON.stringify(fullPath) + "," + JSON.stringify("value-for:" + fullPath) + ");";

    setTimeout(() => {
        res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
        res.end(body);
    }, delay);
}

function requestHandler(req, res) {
    let url = decodeURIComponent(req.url.split("?")[0]);

    if (url === "/") return sendFile(res, path.join(FIXTURES_DIR, "index.html"));
    if (url === "/unit") return sendFile(res, path.join(FIXTURES_DIR, "unit.html"));
    if (url === "/js/j2h.js") return sendFile(res, path.join(REPO_ROOT, "j2h.js"));
    if (url.startsWith("/vendor/")) return sendFile(res, path.join(VENDOR_DIR, url.slice("/vendor/".length)));
    if (url.startsWith("/lib/")) return sendFile(res, path.join(EXAMPLE_DIR, url));
    if (url.startsWith("/pages/")) return sendFile(res, path.join(EXAMPLE_DIR, url));
    if (url.startsWith("/components/")) return sendFile(res, path.join(EXAMPLE_DIR, url));
    if (url.startsWith("/e2e/")) return serveE2EScript(req, res);

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found: " + url);
}

// Starts listening on an ephemeral port and resolves with {server, url}
function start() {
    return new Promise((resolve, reject) => {
        let server = http.createServer(requestHandler);
        server.on("error", reject);
        server.listen(0, "127.0.0.1", () => {
            let { port } = server.address();
            resolve({ server, url: `http://127.0.0.1:${port}` });
        });
    });
}

function stop(server) {
    return new Promise((resolve) => server.close(resolve));
}

module.exports = { start, stop };
