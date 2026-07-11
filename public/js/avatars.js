// The Record Wall. Unlocked cards are stamped in ink; locked ones are
// penciled in — outlines you haven't earned yet. Gates on VERIFIED level
// only; honor XP raises your overall level but never touches The Wall.

import { CONFIG } from "./config.js";
import { state, save, levelFromXP } from "./state.js";
import { renderHeader, toast } from "./ui.js";

const $ = (sel) => document.querySelector(sel);

export function renderAvatars() {
  const verifiedLevel = levelFromXP(state.verifiedXP).level;
  $("#avatar-verified-level").textContent = verifiedLevel;

  const grid = $("#avatar-grid");
  grid.innerHTML = "";

  CONFIG.avatars.forEach((a) => {
    const unlocked = verifiedLevel >= a.requiredLevel;
    const selected = state.selectedAvatar === a.id;
    const away = a.requiredLevel - verifiedLevel;
    const card = document.createElement("button");
    card.className = `avatar-card${unlocked ? "" : " locked"}${selected ? " selected" : ""}`;
    card.innerHTML = `
      ${unlocked ? '<span class="mini-seal" aria-hidden="true">✓</span>' : ""}
      <span class="avatar-emoji">${a.emoji}</span>
      <span class="avatar-name">${a.name}</span>
      <span class="avatar-req">${
        unlocked
          ? selected
            ? "Equipped"
            : "Tap to equip"
          : `${away} level${away === 1 ? "" : "s"} away`
      }</span>
    `;
    card.addEventListener("click", () => {
      if (!unlocked) {
        toast(
          `Penciled in. ${away} more witnessed level${away === 1 ? "" : "s"} for ${a.name}.`,
          "info"
        );
        return;
      }
      state.selectedAvatar = a.id;
      save();
      renderHeader();
      renderAvatars();
      toast(`${a.emoji} ${a.name} equipped.`, "good");
    });
    grid.appendChild(card);
  });
}

export function initAvatars() {
  renderAvatars();
}
