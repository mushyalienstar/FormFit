// Login / signup screen + session restore.

import { api, getToken, setToken, clearToken } from "./api.js";

const $ = (sel) => document.querySelector(sel);

let mode = "login"; // "login" | "signup"

function setMode(next) {
  mode = next;
  $("#auth-tab-login").classList.toggle("active", mode === "login");
  $("#auth-tab-signup").classList.toggle("active", mode === "signup");
  $("#auth-submit").textContent = mode === "login" ? "Log in" : "Create account";
  $("#auth-hint").textContent =
    mode === "login"
      ? "Welcome back — your XP is waiting."
      : "3–20 characters for the username; password 6+.";
  showError("");
}

function showError(msg) {
  const el = $("#auth-error");
  el.textContent = msg;
  el.hidden = !msg;
}

export function showAuth() {
  $("#auth-screen").hidden = false;
  $("#app").hidden = true;
  $("#auth-username").focus();
}

export function hideAuth() {
  $("#auth-screen").hidden = true;
  $("#app").hidden = false;
}

// If a token is stored, validate it and pull the account's saved state.
export async function restoreSession() {
  if (!getToken()) return null;
  try {
    return await api("/api/me"); // { username, state }
  } catch {
    clearToken();
    return null;
  }
}

export function initAuth(onSuccess) {
  $("#auth-tab-login").addEventListener("click", () => setMode("login"));
  $("#auth-tab-signup").addEventListener("click", () => setMode("signup"));
  setMode("login");

  $("#auth-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = $("#auth-username").value.trim();
    const password = $("#auth-password").value;
    const btn = $("#auth-submit");
    btn.disabled = true;
    showError("");
    try {
      const data = await api(`/api/auth/${mode}`, {
        method: "POST",
        body: { username, password },
      });
      setToken(data.token);
      $("#auth-password").value = "";
      onSuccess({ username: data.username, state: data.state });
    } catch (err) {
      showError(err.message);
    } finally {
      btn.disabled = false;
    }
  });
}

export function logout() {
  clearToken();
}
