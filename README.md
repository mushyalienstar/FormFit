# 💪 FormFit

**FormFit** is a camera-verified fitness XP tracker that gamifies your workouts. Built by **Arnav Govil**.

**Live Demo:** [https://form-fit-ten.vercel.app/](https://form-fit-ten.vercel.app/)

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

## Accounts & Database

Node/Express backend with **PostgreSQL**. Sign up / log in (bcrypt-hashed passwords,
JWT sessions); each account's XP, routine, streak, and avatar sync to the server
(debounced), so progress follows you across devices.

## Run it locally

1. Create a `.env` file and add your Neon/Supabase PostgreSQL connection string:
   `DATABASE_URL=postgresql://...`
2. Run the following commands:
```bash
npm install
npm start
# → http://localhost:3000
```
Requires Node 18+.

## Tuning

Everything adjustable lives in `public/js/config.js`: XP curve and awards,
form-check angle thresholds, avatar list + level gates.

## Structure

```
server/          Express API (auth + per-user state) + PostgreSQL config
api/             Vercel serverless entry point
public/          Frontend (no build step, ES modules)
  js/config.js   All tunables: XP economy, form thresholds, avatars
  js/exercises.js  Per-frame form analysis (squat, pushup)
  js/verified.js   Camera + pose loop + rep state machine
  js/honor.js      Routine builder + checklist
  js/state.js      XP/level logic + server sync
```


