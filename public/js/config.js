// ============================================================
// FormFit — all tunables in one place.
// Tweak XP economy, form-check thresholds, and avatar gates here.
// ============================================================

export const CONFIG = {
  xp: {
    // XP required to go from `level` to `level + 1`.
    // Lv1→2: 100, Lv2→3: ~264, Lv3→4: ~466, ...
    xpForLevel: (level) => Math.round(100 * Math.pow(level, 1.4)),

    verifiedRepXP: 10,      // full XP — camera-confirmed rep
    honorItemXP: 15,        // flat XP per checked-off routine item (unverified)
    honorWorkoutBonus: 25,  // bonus for finishing every item in a session
  },

  pose: {
    minVisibility: 0.55, // landmark confidence below this = "get in frame"
    wasmBase:
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
    modelUrl:
      "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  },

  // Squat form thresholds (angles in degrees, knee angle = hip-knee-ankle)
  squat: {
    lockoutAngle: 160,   // knee angle counted as "standing"
    descentTrigger: 140, // knee angle that starts a rep attempt
    depthAngle: 100,     // knee angle that counts as full depth
    maxTorsoLean: 50,    // torso deviation from vertical before "straighten back"
  },

  // Pushup form thresholds (elbow angle = shoulder-elbow-wrist)
  pushup: {
    lockoutAngle: 155,   // elbow angle counted as "arms extended"
    descentTrigger: 130, // elbow angle that starts a rep attempt
    depthAngle: 95,      // elbow angle that counts as full depth
    minBodyLine: 150,    // shoulder-hip-knee angle below this = sag/pike
  },

  // Avatars unlock ONLY via verified level (camera-earned XP).
  avatars: [
    { id: "rookie",  emoji: "🐣", name: "Rookie",   requiredLevel: 1 },
    { id: "sprout",  emoji: "🐥", name: "Fledgling", requiredLevel: 2 },
    { id: "wolf",    emoji: "🐺", name: "Wolf",      requiredLevel: 3 },
    { id: "fox",     emoji: "🦊", name: "Fox",       requiredLevel: 4 },
    { id: "gorilla", emoji: "🦍", name: "Gorilla",   requiredLevel: 5 },
    { id: "rex",     emoji: "🦖", name: "T-Rex",     requiredLevel: 6 },
    { id: "mech",    emoji: "🤖", name: "Mech",      requiredLevel: 8 },
    { id: "dragon",  emoji: "🐉", name: "Dragon",    requiredLevel: 10 },
  ],
};
