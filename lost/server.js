"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const STORE = path.join(ROOT, "data", "lists.json");
const PORT = process.env.PORT || 3847;
const ADMIN_USER = "hoopeystar";
const ADMIN_PIN = "1432";
const SALT = "ll26-hoopey";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".php": "text/plain; charset=utf-8"
};

function pid(name) {
  return String(name || "").trim().toLowerCase();
}
function pinHash(user, pin) {
  return crypto.createHash("sha256").update(pid(user) + ":" + pin + ":" + SALT).digest("hex");
}
function newId() {
  return "p" + crypto.randomBytes(6).toString("hex");
}
function loadStore() {
  try {
    const data = JSON.parse(fs.readFileSync(STORE, "utf8"));
    if (!data || typeof data !== "object" || !data.users) return { users: {} };
    return data;
  } catch (e) {
    return { users: {} };
  }
}
function saveStore(data) {
  const dir = path.dirname(STORE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = STORE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, STORE);
}
function publicPeople(data) {
  return Object.keys(data.users).map(function (key) {
    const u = data.users[key];
    return {
      id: u.id,
      name: u.name,
      picks: u.picks || {},
      notes: u.notes || {},
      updatedAt: u.updatedAt || ""
    };
  });
}
function readBody(req) {
  return new Promise(function (resolve, reject) {
    const chunks = [];
    req.on("data", function (c) { chunks.push(c); });
    req.on("end", function () {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}
function send(res, code, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}
function handleApi(body) {
  const action = body.action || "lists";
  const data = loadStore();
  if (action === "lists") return { code: 200, payload: { ok: true, people: publicPeople(data) } };

  const user = String(body.username || "").trim();
  const pin = String(body.pin || "").replace(/\D/g, "");
  const key = pid(user);

  if (action === "login") {
    if (!user || pin.length !== 4) {
      return { code: 400, payload: { ok: false, error: "Enter a username and a 4-digit PIN" } };
    }
    if (key === ADMIN_USER) {
      if (pin !== ADMIN_PIN) return { code: 403, payload: { ok: false, error: "Wrong PIN" } };
      return { code: 200, payload: { ok: true, admin: true, people: publicPeople(data) } };
    }
    if (!data.users[key]) {
      const row = {
        id: newId(),
        name: user,
        pinHash: pinHash(user, pin),
        picks: {},
        notes: {},
        updatedAt: new Date().toISOString()
      };
      data.users[key] = row;
      saveStore(data);
      return {
        code: 200,
        payload: {
          ok: true,
          created: true,
          user: { id: row.id, name: row.name, picks: {}, notes: {} },
          people: publicPeople(data)
        }
      };
    }
    const row = data.users[key];
    if (row.pinHash !== pinHash(user, pin)) {
      return { code: 403, payload: { ok: false, error: "Wrong PIN" } };
    }
    return {
      code: 200,
      payload: {
        ok: true,
        created: false,
        user: { id: row.id, name: row.name, picks: row.picks || {}, notes: row.notes || {} },
        people: publicPeople(data)
      }
    };
  }

  if (action === "save") {
    if (key === ADMIN_USER) return { code: 400, payload: { ok: false, error: "Admin has no list to save" } };
    const row = data.users[key];
    if (!row) return { code: 404, payload: { ok: false, error: "Unknown username" } };
    if (row.pinHash !== pinHash(user, pin)) return { code: 403, payload: { ok: false, error: "Wrong PIN" } };
    row.picks = body.picks && typeof body.picks === "object" ? body.picks : {};
    row.notes = body.notes && typeof body.notes === "object" ? body.notes : {};
    row.updatedAt = new Date().toISOString();
    saveStore(data);
    return { code: 200, payload: { ok: true, people: publicPeople(data) } };
  }

  if (action === "delete" || action === "deleteAll") {
    if (key !== ADMIN_USER || pin !== ADMIN_PIN) {
      return { code: 403, payload: { ok: false, error: "Admin only" } };
    }
    if (action === "deleteAll") {
      data.users = {};
    } else {
      const target = String(body.id || "");
      const targetName = pid(body.target || "");
      Object.keys(data.users).forEach(function (k) {
        if (data.users[k].id === target || k === targetName) delete data.users[k];
      });
    }
    saveStore(data);
    return { code: 200, payload: { ok: true, people: publicPeople(data) } };
  }

  return { code: 400, payload: { ok: false, error: "Unknown action" } };
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const rel = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || file.indexOf(path.join(ROOT, "data")) === 0) {
    res.writeHead(403); res.end("Forbidden"); return;
  }
  fs.readFile(file, function (err, buf) {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { "Content-Type": TYPES[ext] || "application/octet-stream" });
    res.end(buf);
  });
}

const server = http.createServer(function (req, res) {
  const urlPath = (req.url || "/").split("?")[0];
  const isApi = urlPath === "/api" || urlPath === "/api.php";
  if (isApi) {
    const run = function (body) {
      try {
        const result = handleApi(body || {});
        send(res, result.code, result.payload);
      } catch (e) {
        send(res, 500, { ok: false, error: "Server error" });
      }
    };
    if (req.method === "GET") {
      const q = require("url").parse(req.url, true).query;
      return run({ action: q.action || "lists" });
    }
    return readBody(req).then(run).catch(function () {
      send(res, 400, { ok: false, error: "Bad JSON" });
    });
  }
  serveStatic(req, res);
});

if (!fs.existsSync(STORE)) {
  fs.mkdirSync(path.dirname(STORE), { recursive: true });
  fs.writeFileSync(STORE, JSON.stringify({ users: {} }, null, 2));
}

server.listen(PORT, function () {
  console.log("Lost Lands lock-in running at http://localhost:" + PORT);
});
