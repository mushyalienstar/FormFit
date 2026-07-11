// FormFit entry point — auth gate first, then the app.

import { renderHeader, initTabs, onTabChange, switchTab, toast } from "./ui.js";
import { initVerified, stopCamera } from "./verified.js";
import { initHonor, renderHonor } from "./honor.js";
import { initAvatars, renderAvatars } from "./avatars.js";
import { initAuth, restoreSession, showAuth, hideAuth, logout } from "./auth.js";
import { hydrate, resetState, pushNow } from "./state.js";

const $ = (sel) => document.querySelector(sel);

// ---------- one-time wiring (safe while #app is hidden) ----------
initTabs();
initVerified();
initHonor();
initAvatars();
initAuth(startApp);

onTabChange((tab) => {
  // Don't burn battery / keep the camera hot when the user leaves Verified Mode.
  if (tab !== "verified") stopCamera();
  // Unlock states may have changed since last visit.
  if (tab === "avatars") renderAvatars();
});

$("#logout-btn").addEventListener("click", async () => {
  stopCamera();
  try {
    await pushNow(); // don't lose the last few reps
  } catch {}
  logout();
  resetState();
  showAuth();
  toast("Logged out — progress saved to your account", "info");
});

// ---------- session bootstrap ----------
function startApp({ username, state: serverState }) {
  hydrate(serverState);
  $("#header-username").textContent = username;
  hideAuth();
  renderHeader();
  renderHonor();
  renderAvatars();
  switchTab("verified");
}

(async () => {
  const session = await restoreSession();
  if (session) startApp(session);
  else showAuth();
})();
