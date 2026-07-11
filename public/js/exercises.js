// Exercise definitions: per-frame form analysis for each supported movement.
// Each exercise exposes analyze(pts) -> {
//   visible:   all needed joints tracked confidently
//   keyAngle:  the angle the rep state machine watches (knee / elbow)
//   deep:      this frame reaches full range of motion
//   violation: { cue, reason } for this frame, or null
//     cue    — said to the user live ("Chest up.")
//     reason — short phrase for "Seen, not counted — {reason}."
// }
// `pts` are landmarks in PIXEL space (normalized coords distort angles).

import { CONFIG } from "./config.js";

// MediaPipe Pose landmark indices
export const LM = {
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
  LEFT_WRIST: 15, RIGHT_WRIST: 16,
  LEFT_HIP: 23, RIGHT_HIP: 24,
  LEFT_KNEE: 25, RIGHT_KNEE: 26,
  LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
};

// Angle (degrees) at vertex B formed by points A-B-C.
function angleAt(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (!mag) return 180;
  return (Math.acos(Math.min(1, Math.max(-1, dot / mag))) * 180) / Math.PI;
}

// Degrees the segment lower→upper deviates from straight vertical.
function verticalLean(lower, upper) {
  return Math.abs(Math.atan2(upper.x - lower.x, lower.y - upper.y)) * (180 / Math.PI);
}

function avgVisibility(pts, idxs) {
  return idxs.reduce((s, i) => s + (pts[i].visibility ?? 0), 0) / idxs.length;
}

function pickSide(pts, leftIdxs, rightIdxs) {
  return avgVisibility(pts, leftIdxs) >= avgVisibility(pts, rightIdxs)
    ? leftIdxs
    : rightIdxs;
}

function allVisible(pts, idxs) {
  return idxs.every((i) => (pts[i].visibility ?? 0) >= CONFIG.pose.minVisibility);
}

export const EXERCISES = {
  squat: {
    id: "squat",
    name: "Squats",
    emoji: "🏋️",
    hint: "Whole body in frame. Side-on reads depth best.",
    cfg: {
      lockoutAngle: CONFIG.squat.lockoutAngle,
      descentTrigger: CONFIG.squat.descentTrigger,
      depthAngle: CONFIG.squat.depthAngle,
    },
    cues: {
      ready: "Stand tall. Then sit back.",
      deeper: "Deeper — hips to knee.",
      bottom: "Good. Drive up.",
      notDeepReason: "too shallow",
    },
    analyze(pts) {
      const side = pickSide(
        pts,
        [LM.LEFT_SHOULDER, LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE],
        [LM.RIGHT_SHOULDER, LM.RIGHT_HIP, LM.RIGHT_KNEE, LM.RIGHT_ANKLE]
      );
      if (!allVisible(pts, side)) return { visible: false };
      const [shoulder, hip, knee, ankle] = side.map((i) => pts[i]);

      const keyAngle = angleAt(hip, knee, ankle);
      // Full depth: knee bend past threshold OR hip crease at/below knee (y grows downward)
      const deep = keyAngle <= CONFIG.squat.depthAngle || hip.y >= knee.y;
      const violation =
        verticalLean(hip, shoulder) > CONFIG.squat.maxTorsoLean
          ? { cue: "Chest up.", reason: "back bent" }
          : null;

      return { visible: true, keyAngle, deep, violation };
    },
  },

  pushup: {
    id: "pushup",
    name: "Pushups",
    emoji: "💪",
    hint: "Camera low and side-on — shoulders, hips, knees all visible.",
    cfg: {
      lockoutAngle: CONFIG.pushup.lockoutAngle,
      descentTrigger: CONFIG.pushup.descentTrigger,
      depthAngle: CONFIG.pushup.depthAngle,
    },
    cues: {
      ready: "Lock out. Then lower.",
      deeper: "Lower — chest to the floor.",
      bottom: "Good. Press up.",
      notDeepReason: "not low enough",
    },
    analyze(pts) {
      const side = pickSide(
        pts,
        [LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST, LM.LEFT_HIP, LM.LEFT_KNEE],
        [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW, LM.RIGHT_WRIST, LM.RIGHT_HIP, LM.RIGHT_KNEE]
      );
      if (!allVisible(pts, side)) return { visible: false };
      const [shoulder, elbow, wrist, hip, knee] = side.map((i) => pts[i]);

      const keyAngle = angleAt(shoulder, elbow, wrist);
      const deep = keyAngle <= CONFIG.pushup.depthAngle;
      // Torso must stay a straight line — no hip sag, no piking.
      const bodyLine = angleAt(shoulder, hip, knee);
      const violation =
        bodyLine < CONFIG.pushup.minBodyLine
          ? { cue: "Hips level.", reason: "hips sagged" }
          : null;

      return { visible: true, keyAngle, deep, violation };
    },
  },
};
