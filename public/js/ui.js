// Shared UI: header (avatar, level bars, streak), toasts, tab switching.

import { CONFIG } from "./config.js";
import { state, levelFromXP } from "./state.js";

const $ = (sel) => document.querySelector(sel);

// ---------- Header ----------
export function renderHeader() {
  const overall = levelFromXP(state.totalXP);
  const verified = levelFromXP(state.verifiedXP);

  const avatar = CONFIG.avatars.find((a) => a.id === state.selectedAvatar) ?? CONFIG.avatars[0];
  $("#header-avatar").textContent = avatar.emoji;

  $("#overall-level").textContent = `Lv ${overall.level}`;
  $("#overall-xp-text").textContent = `${overall.into} / ${overall.needed} XP`;
  $("#overall-xp-fill").style.width = `${(overall.into / overall.needed) * 100}%`;

  $("#verified-level").textContent = verified.level;
  $("#verified-xp-text").textContent = `${verified.into} / ${verified.needed}`;
  $("#verified-xp-fill").style.width = `${(verified.into / verified.needed) * 100}%`;

  const streakChip = $("#streak-chip");
  streakChip.hidden = state.streak < 1;
  streakChip.textContent = `🔥 ${state.streak}`;
}

// ---------- Toasts ----------
let toastTimer = null;
export function toast(msg, tone = "info") {
  const el = $("#toast");
  el.textContent = msg;
  el.dataset.tone = tone;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

// ---------- The seal ----------
// Only a verified level-up earns the stamp. Honor level-ups never do.
function sealSVG(level) {
  return `<svg viewBox="0 0 120 120" role="img" aria-label="Witnessed, level ${level}">
    <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" stroke-width="3"/>
    <circle cx="60" cy="60" r="42" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <defs>
      <path id="seal-arc" d="M60,60 m-49,0 a49,49 0 1,1 98,0 a49,49 0 1,1 -98,0"/>
    </defs>
    <text font-family="IBM Plex Mono, monospace" font-size="10.5" letter-spacing="2.5" fill="currentColor">
      <textPath href="#seal-arc">WITNESSED · FORMFIT · WITNESSED · FORMFIT ·</textPath>
    </text>
    <text x="60" y="71" text-anchor="middle" font-family="Zilla Slab, serif"
          font-size="30" font-weight="700" fill="currentColor">LV ${level}</text>
  </svg>`;
}

export function showSeal(level) {
  document.querySelector(".seal-overlay")?.remove();
  const el = document.createElement("div");
  el.className = "seal-overlay";
  el.setAttribute("aria-hidden", "true"); // the toast carries it for screen readers
  el.innerHTML = sealSVG(level);
  document.body.appendChild(el);
  setTimeout(() => el.classList.add("fade"), 1400);
  setTimeout(() => el.remove(), 1900);
}

// Announce level-ups + newly unlocked avatars after an awardXP() call.
export function announce(result) {
  if (result.verifiedLeveledUp) {
    showSeal(result.verifiedLevel);
    const unlocked = CONFIG.avatars.filter(
      (a) =>
        a.requiredLevel > result.prevVerifiedLevel &&
        a.requiredLevel <= result.verifiedLevel
    );
    if (unlocked.length) {
      toast(
        `Witnessed — Lv ${result.verifiedLevel}. On The Wall: ${unlocked
          .map((a) => `${a.emoji} ${a.name}`)
          .join(", ")}.`,
        "good"
      );
      return;
    }
    toast(`Witnessed — Lv ${result.verifiedLevel}.`, "good");
    return;
  }
  if (result.leveledUp) toast(`Lv ${result.level} — on your word.`, "info");
}

// ---------- Tabs ----------
const tabListeners = [];
export function onTabChange(fn) {
  tabListeners.push(fn);
}

export function switchTab(id) {
  document.querySelectorAll("#tabs button").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === id);
  });
  document.querySelectorAll("main .view").forEach((v) => {
    v.classList.toggle("active", v.id === `view-${id}`);
  });
  tabListeners.forEach((fn) => fn(id));
}

export function initTabs() {
  document.querySelectorAll("#tabs button").forEach((b) => {
    b.addEventListener("click", () => switchTab(b.dataset.tab));
  });
}
