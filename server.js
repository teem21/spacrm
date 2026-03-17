const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 8080;
const DATA_DIR = path.join(__dirname, "data");

// Ensure data dir exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Key → filename (safe encoding)
const keyToFile = (key) => path.join(DATA_DIR, encodeURIComponent(key) + ".json");

// MIME types
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".jsx":  "text/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // ─── Storage API ───────────────────────────────────────────────────
  if (url.pathname === "/api/storage/get") {
    const key = url.searchParams.get("key");
    if (!key) { res.writeHead(400); res.end("missing key"); return; }
    const file = keyToFile(key);
    if (fs.existsSync(file)) {
      const value = fs.readFileSync(file, "utf-8");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ value }));
    } else {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("null");
    }
    return;
  }

  if (url.pathname === "/api/storage/set" && req.method === "POST") {
    const body = JSON.parse(await readBody(req));
    const file = keyToFile(body.key);
    fs.writeFileSync(file, body.value, "utf-8");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (url.pathname === "/api/storage/delete" && req.method === "POST") {
    const body = JSON.parse(await readBody(req));
    const file = keyToFile(body.key);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (url.pathname === "/api/storage/list") {
    const prefix = url.searchParams.get("prefix") || "";
    const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
    const keys = files
      .map((f) => decodeURIComponent(f.replace(/\.json$/, "")))
      .filter((k) => k.startsWith(prefix));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ keys }));
    return;
  }

  // ─── Static files ──────────────────────────────────────────────────
  let filePath = path.join(__dirname, url.pathname === "/" ? "index.html" : url.pathname);
  filePath = path.normalize(filePath);

  // Security: prevent directory traversal
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403); res.end("Forbidden"); return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404); res.end("Not found"); return;
  }

  const ext = path.extname(filePath);
  const contentType = MIME[ext] || "application/octet-stream";
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { "Content-Type": contentType });
  res.end(content);
});

server.listen(PORT, () => {
  console.log(`CRM server running at http://localhost:${PORT}`);
});
