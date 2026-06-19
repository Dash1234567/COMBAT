# 🥊 COMBAT

**Train smarter, fight harder.** COMBAT is a free, game-like training planner for
combat sports — built to make conditioning, strength, dieting, and weight cutting
easy to manage in one place.

> For conditioning, strength, dieting, and potential weight cutting.

The mission: make combat sports **easier to manage and more popular**. Great
coaching shouldn't be a luxury — COMBAT gives every athlete, from first-day
beginner to seasoned pro, a clear and structured path to follow, with a friendly,
Duolingo-style experience that's genuinely fun to stick with.

---

## Features

- **AI Coach** — a chat coach for nutrition, endurance, strength, weight
  cutting, recovery, and mindset, with sport-specific guidance modeled on
  leading wrestling and boxing coaches (built from scratch, no API key needed).
- **Create Plan flow** — a quick, one-question-at-a-time wizard (sport, goal,
  experience, training days, and optional weight targets).
- **Personalized weekly schedule** — sessions are assembled from a SQL exercise
  library and tailored to your discipline, goal, and experience level.
- **Discipline-specific skill work** — Boxing, MMA, BJJ, Muay Thai, Wrestling,
  Kickboxing, and Karate.
- **Weight-cut pacing & safety** — calculates the weekly loss needed before your
  event date and flags cuts that are faster than recommended.
- **Nutrition guidance** — practical tips tuned to your goal.
- **Gamified tracking** — tick off sessions to earn XP and build a daily streak.
- **Fully responsive** — works on phones, tablets, and desktops.

## Tech stack

| Layer     | Technology                                              |
| --------- | ------------------------------------------------------- |
| Front end | HTML, CSS (custom design system), vanilla JS (ES modules) |
| Back end  | Node.js — built-in `http` server (zero third-party dependencies) |
| Database  | SQLite via Node's built-in `node:sqlite` module (real SQL, no native build step) |

## Requirements

- **Node.js ≥ 22.5** (uses the built-in `node:sqlite` module)

## Quick start

COMBAT has **zero third-party dependencies**, so there's no install step.
Run this single command in your terminal:

```bash
npm start
```

Then open the local host in your browser:

### ➜ http://localhost:3000

Use a different port with `PORT=8080 npm start`.

## Project structure

```
COMBAT/
├── server.js              # Express server + JSON API
├── db/
│   └── schema.sql         # SQLite schema (plans, sessions, exercises…)
├── lib/
│   ├── db.js              # DB connection, schema init, seeding
│   ├── exercises.js       # Seed exercise/drill library
│   ├── planGenerator.js   # Builds the weekly schedule from the library
│   └── coach.js           # AI Coach knowledge base + matching engine
├── public/                # Static front end
│   ├── index.html         # Homepage (intro, mission, Create Plan)
│   ├── create.html        # Create Plan wizard
│   ├── plans.html         # My Plans dashboard
│   ├── plan.html          # Plan detail + tracking
│   ├── coach.html         # AI Coach chat
│   ├── css/styles.css     # Design system
│   └── js/                # app.js (shared), create.js, plan.js, plans.js, coach.js
└── data/                  # SQLite DB file (created at runtime, git-ignored)
```

## How it works

When you create a plan, the server stores it in SQLite and `planGenerator.js`
builds a 7-day week: training days are assigned a **focus** (Strength,
Conditioning, Skills & Technique, Sparring & Drills, or Mobility & Recovery)
based on your goal, then exercises are pulled from the library with SQL queries
that match the focus and your discipline. Beginners get fewer movements per
session than advanced athletes.

### Data model

`plans` → `sessions` (one row per weekday) → `session_exercises`, with a shared
`exercises` library. Foreign keys cascade, so deleting a plan removes its
sessions and exercises automatically.

### API reference

| Method   | Endpoint                   | Description                          |
| -------- | -------------------------- | ------------------------------------ |
| `GET`    | `/api/plans`               | List all plans (with progress)       |
| `POST`   | `/api/plans`               | Create a plan and generate its week  |
| `GET`    | `/api/plans/:id`           | Full plan detail + weight analysis   |
| `DELETE` | `/api/plans/:id`           | Delete a plan (cascades)             |
| `POST`   | `/api/sessions/:id/toggle` | Toggle a session; updates XP & streak|
| `POST`   | `/api/coach`               | Ask the AI Coach a question          |

## AI Coach

COMBAT includes a built-from-scratch **AI Coach** (no external API key required):
a chat assistant that combines sports-nutrition, endurance, and strength
knowledge and answers questions with guidance tuned to your sport. It draws on
the methods of leading coaches:

- **Wrestling** — Cael Sanderson, Morgan Flaharty, Ivan Ivanov, and Wrestling Mindset
- **Boxing** — Boxing Science (Danny Wilson & Alan Ruddock), Dr Andy Galpin, and Greg Robinson

Open it from the **AI Coach** tab, pick your sport, and ask away. Responses are
generated by a local knowledge-base engine in `lib/coach.js`.

## Notes

- All data lives in `data/combat.db`, which is created on first run and
  git-ignored. Delete the `data/` folder to reset the app.
- The exercise prescriptions and weight-cut guidance are general training
  information — always train and cut weight under qualified supervision.
