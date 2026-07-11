// App state: XP tracks, streak, routine, active session.
// Total XP = verified XP + honor XP. Avatars gate on VERIFIED XP only.
// State lives on the server per account; saves are debounced pushes.

import { CONFIG } from "./config.js";
import { api, getToken, authHeader } from "./api.js";

const defaultState = {
  totalXP: 0,
  verifiedXP: 0, // camera-confirmed XP — the only track that unlocks avatars
  honorXP: 0,
  selectedAvatar: "rookie",
  routine: [
    { id: "r1", name: "Pushups", detail: "2 × 10" },
    { id: "r2", name: "Squats", detail: "2 × 15" },
    { id: "r3", name: "Plank", detail: "30s" },
    { id: "r4", name: "Jumping jacks", detail: "20" },
  ],
  session: null, // { items: [{ name, detail, done }] } — survives refresh
  streak: 0,
  lastActiveDay: null,
  lifetime: { verifiedReps: 0, attemptedReps: 0, honorItems: 0, workouts: 0 },
};

export const state = structuredClone(defaultState);

// Replace state contents with the account's saved state (or defaults).
export function hydrate(serverState) {
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, structuredClone(defaultState), serverState || {});
}

export function resetState() {
  hydrate(null);
}

// ---------- server sync ----------
let pushTimer = null;

export function save() {
  if (!getToken()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => pushNow().catch(() => {}), 800);
}

export async function pushNow() {
  if (!getToken()) return;
  clearTimeout(pushTimer);
  pushTimer = null;
  await api("/api/state", { method: "PUT", body: { state } });
}

// Flush a pending save if the tab closes mid-debounce.
window.addEventListener("pagehide", () => {
  if (!pushTimer || !getToken()) return;
  clearTimeout(pushTimer);
  pushTimer = null;
  fetch("/api/state", {
    method: "PUT",
    keepalive: true,
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({ state }),
  }).catch(() => {});
});

// ---------- XP / levels ----------

// Convert an XP total into { level, into (XP into current level), needed }.
export function levelFromXP(xp) {
  let level = 1;
  let remaining = xp;
  while (remaining >= CONFIG.xp.xpForLevel(level)) {
    remaining -= CONFIG.xp.xpForLevel(level);
    level++;
  }
  return { level, into: remaining, needed: CONFIG.xp.xpForLevel(level) };
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function touchStreak() {
  const today = todayKey();
  if (state.lastActiveDay === today) return;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yKey = `${yesterday.getFullYear()}-${yesterday.getMonth() + 1}-${yesterday.getDate()}`;
  state.streak = state.lastActiveDay === yKey ? state.streak + 1 : 1;
  state.lastActiveDay = today;
}

// Award XP to the right track. Returns level-change info so the UI
// can announce level-ups and freshly unlocked avatars.
export function awardXP(amount, { verified }) {
  const prevLevel = levelFromXP(state.totalXP).level;
  const prevVerifiedLevel = levelFromXP(state.verifiedXP).level;

  state.totalXP += amount;
  if (verified) state.verifiedXP += amount;
  else state.honorXP += amount;

  touchStreak();
  save();

  const level = levelFromXP(state.totalXP).level;
  const verifiedLevel = levelFromXP(state.verifiedXP).level;
  return {
    leveledUp: level > prevLevel,
    level,
    verifiedLeveledUp: verifiedLevel > prevVerifiedLevel,
    verifiedLevel,
    prevVerifiedLevel,
  };
}
