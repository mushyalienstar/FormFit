# 💪 FormFit — Camera-Verified Fitness XP Tracker

Gamified workouts with a twist: the camera is the referee. Clean, full-range reps
earn full XP and unlock avatars; honor-system workouts earn reduced XP that never
unlocks cosmetics.

## Modes

| | 📷 Verified Mode | 📝 Honor Mode |
|---|---|---|
| How | MediaPipe pose detection checks form + range of motion in the browser | Build a routine, check items off |
| XP | 10 XP per verified rep | 15 XP flat per item + 25 finish bonus |
| Avatar unlocks | ✅ Yes — gated on **verified level** only | ❌ Never |
| Streak / overall level | ✅ | ✅ |

**Exercises:** Squats (knee angle + hip depth + back straightness) and Pushups
(elbow angle + body-line sag/pike check). Near-miss reps show as *attempted* with
the reason, so users learn what didn't count and why.

## Accounts

Node/Express backend with SQLite. Sign up / log in (bcrypt-hashed passwords,
JWT sessions); each account's XP, routine, streak, and avatar sync to the server
(debounced), so progress follows you across devices.

## Run it

```bash
npm install
npm start
# → http://localhost:3000
```

Requires Node 18+. The SQLite DB is created automatically in `data/`.

### Deploy (for the online demo)

Works on any Node host (Render / Railway / Fly). Set `JWT_SECRET` in production.
**HTTPS is required for camera access** on anything other than localhost — the
hosts above provide it out of the box. Note: on ephemeral-disk free tiers the
SQLite file resets on redeploy; fine for a hackathon demo.

## Tuning

Everything adjustable lives in `public/js/config.js`: XP curve and awards,
form-check angle thresholds, avatar list + level gates.

## Structure

```
server/          Express API (auth + per-user state) + SQLite
public/          Frontend (no build step, ES modules)
  js/config.js   All tunables: XP economy, form thresholds, avatars
  js/exercises.js  Per-frame form analysis (squat, pushup)
  js/verified.js   Camera + pose loop + rep state machine
  js/honor.js      Routine builder + checklist
  js/state.js      XP/level logic + server sync
```

⚠️ XP is client-authoritative (the server trusts the client's state blob) —
anti-cheat is out of scope for the hackathon.
