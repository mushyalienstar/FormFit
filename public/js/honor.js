// Honor Mode: build a routine, check items off, earn reduced flat XP.
// Deliberately unverified — never contributes to avatar unlocks.

import { CONFIG } from "./config.js";
import { state, save, awardXP } from "./state.js";
import { renderHeader, toast, announce } from "./ui.js";

const $ = (sel) => document.querySelector(sel);

// ---------- Routine builder ----------
function renderRoutine() {
  const list = $("#routine-list");
  list.innerHTML = "";
  if (!state.routine.length) {
    list.innerHTML = `<li class="empty">Nothing here yet. Add your first exercise below.</li>`;
  }
  state.routine.forEach((item) => {
    const li = document.createElement("li");
    li.className = "routine-item";
    li.innerHTML = `
      <span class="routine-name">${escapeHtml(item.name)}</span>
      <span class="routine-detail">${escapeHtml(item.detail)}</span>
      <button class="icon-btn" title="Remove" data-remove="${item.id}">✕</button>
    `;
    list.appendChild(li);
  });
  $("#start-workout").disabled = !state.routine.length;
}

function addRoutineItem(name, detail) {
  state.routine.push({
    id: `r${state.routine.length}-${state.routine.map((r) => r.id).join("").length}`,
    name,
    detail,
  });
  save();
  renderRoutine();
}

function removeRoutineItem(id) {
  state.routine = state.routine.filter((r) => r.id !== id);
  save();
  renderRoutine();
}

// ---------- Active session (checklist) ----------
function startWorkout() {
  state.session = {
    items: state.routine.map((r) => ({ name: r.name, detail: r.detail, done: false })),
  };
  save();
  renderSession();
}

function renderSession() {
  const hasSession = !!state.session;
  $("#routine-card").hidden = hasSession;
  $("#session-card").hidden = !hasSession;
  if (!hasSession) return;

  const list = $("#session-list");
  list.innerHTML = "";
  state.session.items.forEach((item, i) => {
    const li = document.createElement("li");
    li.className = `session-item${item.done ? " done" : ""}`;
    li.innerHTML = `
      <label>
        <input type="checkbox" data-check="${i}" ${item.done ? "checked disabled" : ""} />
        <span class="routine-name">${escapeHtml(item.name)}</span>
        <span class="routine-detail">${escapeHtml(item.detail)}</span>
        <span class="xp-tag">+${CONFIG.xp.honorItemXP} XP</span>
      </label>
    `;
    list.appendChild(li);
  });

  const allDone = state.session.items.every((i) => i.done);
  const finishBtn = $("#finish-workout");
  finishBtn.disabled = !allDone;
  finishBtn.textContent = allDone
    ? `Done — take +${CONFIG.xp.honorWorkoutBonus} XP`
    : `Check everything off first`;
}

function checkItem(index) {
  const item = state.session.items[index];
  if (!item || item.done) return;
  item.done = true; // no unchecking — XP is already awarded
  state.lifetime.honorItems++;
  const res = awardXP(CONFIG.xp.honorItemXP, { verified: false });
  renderHeader();
  announce(res);
  renderSession();
}

function finishWorkout() {
  state.lifetime.workouts++;
  state.session = null;
  const res = awardXP(CONFIG.xp.honorWorkoutBonus, { verified: false });
  renderHeader();
  announce(res);
  toast(`All checked. +${CONFIG.xp.honorWorkoutBonus} XP — on your word.`, "info");
  renderSession();
  renderRoutine();
}

function cancelWorkout() {
  state.session = null; // XP already earned on checked items is kept
  save();
  renderSession();
  renderRoutine();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

// ---------- Wiring ----------
// Re-render after login hydrates a different account's state.
export function renderHonor() {
  renderRoutine();
  renderSession(); // resumes an in-progress session after refresh/login
}

export function initHonor() {
  renderHonor();

  $("#routine-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#routine-name").value.trim();
    const detail = $("#routine-detail").value.trim() || "1 set";
    if (!name) return;
    addRoutineItem(name, detail);
    $("#routine-name").value = "";
    $("#routine-detail").value = "";
    $("#routine-name").focus();
  });

  $("#routine-list").addEventListener("click", (e) => {
    const id = e.target.dataset.remove;
    if (id) removeRoutineItem(id);
  });

  $("#session-list").addEventListener("change", (e) => {
    const i = e.target.dataset.check;
    if (i !== undefined) checkItem(Number(i));
  });

  $("#start-workout").addEventListener("click", startWorkout);
  $("#finish-workout").addEventListener("click", finishWorkout);
  $("#cancel-workout").addEventListener("click", cancelWorkout);
}
