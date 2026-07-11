// FormFit backend: serves the frontend + a small JSON API for
// accounts (signup/login, bcrypt + JWT) and per-user state sync.
require("dotenv").config();

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

async function loadState(userId) {
  const result = await db.query("SELECT data FROM states WHERE user_id = $1", [userId]);
  const row = result.rows[0];
  return row ? JSON.parse(row.data) : null;
}

// ---------- auth routes ----------
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (typeof username !== "string" || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return res
        .status(400)
        .json({ error: "Username must be 3–20 letters, numbers, or underscores" });
    }
    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    
    const existing = await db.query("SELECT * FROM users WHERE username = $1", [username]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "That username is taken" });
    }
    
    const hash = await bcrypt.hash(password, 10);
    const result = await db.query(
      "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id",
      [username, hash]
    );
    const user = { id: result.rows[0].id, username };
    res.json({ token: signToken(user), username, state: null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    let user = null;
    if (typeof username === "string") {
      const result = await db.query("SELECT * FROM users WHERE username = $1", [username.trim()]);
      user = result.rows[0];
    }
    
    const ok = user && (await bcrypt.compare(String(password ?? ""), user.password_hash));
    if (!ok) return res.status(401).json({ error: "Wrong username or password" });
    
    const state = await loadState(user.id);
    res.json({ token: signToken(user), username: user.username, state });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------- session + state sync ----------
app.get("/api/me", auth, async (req, res) => {
  try {
    const state = await loadState(req.user.uid);
    res.json({ username: req.user.username, state });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/api/state", auth, async (req, res) => {
  try {
    const { state } = req.body || {};
    if (!state || typeof state !== "object" || Array.isArray(state)) {
      return res.status(400).json({ error: "Invalid state payload" });
    }
    const data = JSON.stringify(state);
    if (data.length > MAX_STATE_BYTES) {
      return res.status(413).json({ error: "State payload too large" });
    }
    
    await db.query(`
      INSERT INTO states (user_id, data, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
    `, [req.user.uid, data]);
    
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`FormFit running → http://localhost:${PORT}`);
    if (!process.env.JWT_SECRET) {
      console.log("(dev) Using generated JWT secret in data/.jwt-secret — set JWT_SECRET in production.");
    }
  });
}

module.exports = app;
