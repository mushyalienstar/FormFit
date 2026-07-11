// FormFit backend: serves the frontend + a small JSON API for
// accounts (signup/login, bcrypt + JWT) and per-user state sync.

const express = require("express");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./db");

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || devSecret();
const TOKEN_TTL = "30d";
const MAX_STATE_BYTES = 50_000; // state blob is small; reject anything bloated

function devSecret() {
  // Stable per-install dev secret so restarts don't log everyone out.
  // Set JWT_SECRET in production.
  const fs = require("fs");
  const p = path.join(__dirname, "..", "data", ".jwt-secret");
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (!fs.existsSync(p)) fs.writeFileSync(p, crypto.randomBytes(32).toString("hex"));
  return fs.readFileSync(p, "utf8").trim();
}

const app = express();
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

// ---------- helpers ----------
const stmts = {
  userByName: db.prepare("SELECT * FROM users WHERE username = ?"),
  insertUser: db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)"),
  getState: db.prepare("SELECT data FROM states WHERE user_id = ?"),
  upsertState: db.prepare(`
    INSERT INTO states (user_id, data, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
  `),
};

function signToken(user) {
  return jwt.sign({ uid: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  });
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not logged in" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Session expired — log in again" });
  }
}

function loadState(userId) {
  const row = stmts.getState.get(userId);
  return row ? JSON.parse(row.data) : null;
}

// ---------- auth routes ----------
app.post("/api/auth/signup", async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== "string" || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return res
      .status(400)
      .json({ error: "Username must be 3–20 letters, numbers, or underscores" });
  }
  if (typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  if (stmts.userByName.get(username)) {
    return res.status(409).json({ error: "That username is taken" });
  }
  const hash = await bcrypt.hash(password, 10);
  const info = stmts.insertUser.run(username, hash);
  const user = { id: info.lastInsertRowid, username };
  res.json({ token: signToken(user), username, state: null });
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body || {};
  const user =
    typeof username === "string" ? stmts.userByName.get(username.trim()) : null;
  const ok = user && (await bcrypt.compare(String(password ?? ""), user.password_hash));
  if (!ok) return res.status(401).json({ error: "Wrong username or password" });
  res.json({ token: signToken(user), username: user.username, state: loadState(user.id) });
});

// ---------- session + state sync ----------
app.get("/api/me", auth, (req, res) => {
  res.json({ username: req.user.username, state: loadState(req.user.uid) });
});

app.put("/api/state", auth, (req, res) => {
  const { state } = req.body || {};
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return res.status(400).json({ error: "Invalid state payload" });
  }
  const data = JSON.stringify(state);
  if (data.length > MAX_STATE_BYTES) {
    return res.status(413).json({ error: "State payload too large" });
  }
  stmts.upsertState.run(req.user.uid, data);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`FormFit running → http://localhost:${PORT}`);
  if (!process.env.JWT_SECRET) {
    console.log("(dev) Using generated JWT secret in data/.jwt-secret — set JWT_SECRET in production.");
  }
});
