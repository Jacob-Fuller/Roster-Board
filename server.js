// Minimal static file server for Roster Board — no dependencies.
// Render (or any Node host) runs this as the Web Service "start command".
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

// Only these files (plus the screenshots folder) are public. Everything else in
// the repo — README, native/, .git, server.js itself — is never served.
const PUBLIC_FILES = new Set([
  "/index.html", "/privacy.html", "/manifest.json", "/sw.js",
  "/icon.svg", "/icon-192.png", "/icon-512.png", "/icon-1024.png",
  "/icon-maskable-192.png", "/icon-maskable-512.png", "/apple-touch-icon.png"
]);
function isPublic(urlPath) {
  if (PUBLIC_FILES.has(urlPath)) return true;
  return /^\/screenshots\/[A-Za-z0-9._-]+\.png$/.test(urlPath);
}

const SUPABASE = "https://ebwfzcbynbsucrjnlumg.supabase.co";
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",
    "connect-src 'self' " + SUPABASE + " " + SUPABASE.replace("https://", "wss://") +
      " https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.googleapis.com https://fonts.gstatic.com",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'"
  ].join("; ")
};

function send(res, status, headers, body) {
  res.writeHead(status, Object.assign({}, SECURITY_HEADERS, headers));
  res.end(body);
}

http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  } catch (e) {
    send(res, 400, { "Content-Type": "text/plain" }, "Bad request");
    return;
  }
  if (urlPath === "/") urlPath = "/index.html";
  urlPath = path.posix.normalize(urlPath);

  // Hidden files and folders (.git, .env, …) and repo folders are never served.
  if (/(^|\/)\./.test(urlPath) || /^\/(native|screenshots)(\/|$)/.test(urlPath) && !isPublic(urlPath)) {
    send(res, 404, { "Content-Type": "text/plain" }, "Not found");
    return;
  }

  if (!isPublic(urlPath)) {
    // A missing file (anything with an extension) is a real 404, so the app's
    // offline cache never stores the home page in place of an icon or script.
    // Other paths (e.g. an old link) get the app itself.
    if (path.extname(urlPath)) {
      send(res, 404, { "Content-Type": "text/plain" }, "Not found");
      return;
    }
    urlPath = "/index.html";
  }

  const filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT + path.sep)) {
    send(res, 403, { "Content-Type": "text/plain" }, "Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      send(res, 404, { "Content-Type": "text/plain" }, "Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    // The page, service worker and manifest must always be re-checked so every
    // device picks up a new version straight away.
    const fresh = urlPath === "/index.html" || urlPath === "/sw.js" || urlPath === "/manifest.json" || urlPath === "/privacy.html";
    send(res, 200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": fresh ? "no-cache" : "public, max-age=86400"
    }, data);
  });
}).listen(PORT, () => {
  console.log("Roster Board serving on port " + PORT);
});
