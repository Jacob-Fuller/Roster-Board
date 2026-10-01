// Copies the live web app (repo root) into native/www so Capacitor can bundle it.
// Run from the native/ folder:  npm run copy-web
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..", "..");
const out = path.resolve(__dirname, "..", "www");
const files = [
  "index.html", "privacy.html", "manifest.json",
  "icon-192.png", "icon-512.png", "apple-touch-icon.png",
  "icon-maskable-192.png", "icon-maskable-512.png", "icon.svg"
];
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const f of files) {
  const src = path.join(root, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(out, f));
  else console.warn("missing (skipped):", f);
}
console.log("Copied web app into", out);
