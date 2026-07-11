// Verified Mode: camera + MediaPipe pose detection + rep state machine.
// Reps only award XP when they hit full range of motion with clean form;
// near-misses show as "attempted" with the reason, so users know why.

import { CONFIG } from "./config.js";
import { EXERCISES } from "./exercises.js";
import { state, save, awardXP, levelFromXP } from "./state.js";
import { renderHeader, toast, announce, switchTab } from "./ui.js";
import { setOdometer, renderTally } from "./counter.js";

const $ = (sel) => document.querySelector(sel);

// MediaPipe is loaded lazily on first camera start, so a slow/blocked CDN
// can never break the rest of the app (login, honor mode, avatars).
const MEDIAPIPE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
let mp = null; // { FilesetResolver, PoseLandmarker, DrawingUtils }

let landmarker = null;
let stream = null;
let running = false;
let rafId = null;
let lastVideoTime = -1;
let drawingUtils = null;
let counter = null;
let currentExerciseId = "squat";
let cueOverride = null; // { text, tone, until } — sticky near-miss reason

// ---------- Rep state machine ----------
// up → (keyAngle < descentTrigger) → down → (keyAngle > lockoutAngle) → up = 1 attempt.
// Counted only if the attempt reached depth AND had zero form violations.
class RepCounter {
  constructor(exercise) {
    this.ex = exercise;
    this.phase = "up";
    this.wasDeep = false;
    this.violations = new Set();
    this.reps = 0;
    this.attempted = 0;
    this.cue = { text: exercise.cues.ready, tone: "info" };
  }

  update(frame) {
    if (!frame.visible) {
      this.cue = { text: "Whole body in frame.", tone: "warn" };
      return null;
    }
    const { cfg, cues } = this.ex;
    let event = null;

    if (this.phase === "up") {
      this.cue = { text: cues.ready, tone: "info" };
      if (frame.keyAngle <= cfg.descentTrigger) {
        this.phase = "down";
        this.wasDeep = false;
        this.violations.clear();
      }
    }

    if (this.phase === "down") {
      if (frame.deep) this.wasDeep = true;
      if (frame.violation) this.violations.add(frame.violation.reason);

      if (frame.violation) this.cue = { text: frame.violation.cue, tone: "bad" };
      else if (this.wasDeep) this.cue = { text: cues.bottom, tone: "good" };
      else this.cue = { text: cues.deeper, tone: "warn" };

      if (frame.keyAngle >= cfg.lockoutAngle) {
        this.phase = "up";
        const clean = this.violations.size === 0;
        if (this.wasDeep && clean) {
          this.reps++;
          event = { counted: true };
        } else {
          this.attempted++;
          event = {
            counted: false,
            reason: this.wasDeep ? [...this.violations][0] : cues.notDeepReason,
          };
        }
      }
    }
    return event;
  }
}

// ---------- Model / camera lifecycle ----------
async function ensureLandmarker() {
  if (landmarker) return landmarker;
  $("#camera-status").textContent = "Loading pose model…";
  mp = mp || (await import(MEDIAPIPE_URL));
  const vision = await mp.FilesetResolver.forVisionTasks(CONFIG.pose.wasmBase);
  landmarker = await mp.PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: CONFIG.pose.modelUrl, delegate: "GPU" },
    runningMode: "VIDEO",
    numPoses: 1,
  });
  return landmarker;
}

async function startCamera() {
  const video = $("#cam");
  $("#camera-error").hidden = true;
  $("#start-camera").disabled = true;
  try {
    await ensureLandmarker();
    $("#camera-status").textContent = "Requesting camera…";
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 720 } },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();

    const canvas = $("#overlay");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    drawingUtils = new mp.DrawingUtils(canvas.getContext("2d"));

    counter = new RepCounter(EXERCISES[currentExerciseId]);
    updateHUD();

    $("#camera-idle").hidden = true;
    $("#camera-stage").hidden = false;
    $("#workout-rail").hidden = false;
    $("#camera-status").textContent = "";

    running = true;
    lastVideoTime = -1;
    loop();
  } catch (err) {
    console.error(err);
    stopCamera();
    // Graceful fallback: offer Honor Mode instead of a dead end.
    $("#camera-error").hidden = false;
    $("#camera-error-msg").textContent =
      err.name === "NotAllowedError"
        ? "Camera blocked. Allow it in your browser — or log this one on your word."
        : err.name === "NotFoundError"
          ? "No camera on this device. You can still log it on your word."
          : "Camera or model didn't load. Check your connection — or log it on your word.";
  } finally {
    $("#start-camera").disabled = false;
  }
}

export function stopCamera() {
  running = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  const video = $("#cam");
  if (video) video.srcObject = null;
  $("#camera-stage").hidden = true;
  $("#workout-rail").hidden = true;
  $("#camera-idle").hidden = false;
}

// ---------- Per-frame loop ----------
function loop() {
  if (!running) return;
  const video = $("#cam");
  if (video.currentTime !== lastVideoTime && video.videoWidth > 0) {
    lastVideoTime = video.currentTime;
    const result = landmarker.detectForVideo(video, performance.now());
    handleResult(result, video);
  }
  rafId = requestAnimationFrame(loop);
}

function handleResult(result, video) {
  const canvas = $("#overlay");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const lms = result.landmarks?.[0];
  if (!lms) {
    counter.cue = { text: "Step into frame.", tone: "warn" };
    updateHUD();
    return;
  }

  // Skeleton overlay: chalk lines, ink joints
  drawingUtils.drawConnectors(lms, mp.PoseLandmarker.POSE_CONNECTIONS, {
    color: "rgba(239, 233, 218, 0.75)",
    lineWidth: 3,
  });
  drawingUtils.drawLandmarks(lms, { color: "#5D7BE8", radius: 4 });

  // Angles must be computed in pixel space — normalized coords skew them.
  const pts = lms.map((l) => ({
    x: l.x * video.videoWidth,
    y: l.y * video.videoHeight,
    visibility: l.visibility,
  }));

  const frame = counter.ex.analyze(pts);
  const event = counter.update(frame);

  if (event) {
    if (event.counted) {
      state.lifetime.verifiedReps++;
      const res = awardXP(CONFIG.xp.verifiedRepXP, { verified: true });
      renderHeader();
      announce(res);
    } else {
      state.lifetime.attemptedReps++;
      save();
      // Sticky reason so the user sees WHY it didn't count.
      cueOverride = {
        text: `Seen, not counted — ${event.reason}.`,
        tone: "bad",
        until: performance.now() + 2000,
      };
    }
  }
  updateHUD();
}

function updateHUD() {
  setOdometer($("#rep-odometer"), counter.reps);
  renderTally($("#tally"), counter.attempted);
  $("#attempt-count").textContent = counter.attempted;

  const cueEl = $("#cue");
  const active =
    cueOverride && performance.now() < cueOverride.until ? cueOverride : counter.cue;
  if (cueOverride && performance.now() >= cueOverride.until) cueOverride = null;
  cueEl.textContent = active.text;
  cueEl.dataset.tone = active.tone;

  // Glanceable target: reps left to the next witnessed level.
  const v = levelFromXP(state.verifiedXP);
  const reps = Math.ceil((v.needed - v.into) / CONFIG.xp.verifiedRepXP);
  $("#to-next").textContent = `${reps} rep${reps === 1 ? "" : "s"} to Lv ${v.level + 1}`;
}

// ---------- Wiring ----------
function selectExercise(id) {
  currentExerciseId = id;
  document.querySelectorAll(".exercise-picker button").forEach((b) => {
    b.classList.toggle("active", b.dataset.exercise === id);
  });
  $("#exercise-hint").textContent = EXERCISES[id].hint;
  $("#status-label").textContent = `${EXERCISES[id].name.toUpperCase()} — WITNESSED`;
  if (running) {
    counter = new RepCounter(EXERCISES[id]);
    toast(`${EXERCISES[id].name} — counter reset.`, "info");
    updateHUD();
  }
}

export function initVerified() {
  document.querySelectorAll(".exercise-picker button").forEach((b) => {
    b.addEventListener("click", () => selectExercise(b.dataset.exercise));
  });
  selectExercise(currentExerciseId);

  $("#start-camera").addEventListener("click", startCamera);
  $("#stop-camera").addEventListener("click", () => {
    stopCamera();
    toast("Camera off. Counted reps are saved.", "info");
  });
  $("#retry-camera").addEventListener("click", startCamera);
  $("#goto-honor").addEventListener("click", () => switchTab("honor"));
}
