# API Handoff — Backend Module (Aaditya) → Student Portal Frontend

Base URL (local): `http://localhost:4000` — CORS open, JSON everywhere.
IDs are integers. Timestamps are ISO strings. Errors look like `{ "error": "..." }`
with HTTP 400 (bad input) / 404 (unknown id) / 500 (server).

## ✅ FINALIZED — build frontend against these (shapes are frozen)

### Catalog
- `GET /health` → `{ "ok": true, "service": "sih-26044-matching" }`
- `GET /api/students` → `{ data: [{ id, name, email, department, cgpa, targetRole }] }` (ordered by id)
- `GET /api/opportunities` → `{ data: [{ id, title, type, targetRole, minCgpa, industry }] }` (open only; `type` ∈ JOB \| INTERNSHIP \| FDP)
- `GET /api/skills` → `{ data: [{ id, name, category }] }` (ordered by name)

### Matching
- `GET /api/match/:studentId?limit=5` → `{ studentId, matches: [match] }`, sorted by score desc, where match =
  `{ opportunityId, opportunity: { id, title, type, targetRole, minCgpa }, score (0–100), baseScore, bonuses: { cgpa, projects, total }, matchedSkills: [{ skillId, skill, proficiency, requiredLevel, weightage }], missingSkills: [{ skillId, skill, requiredLevel, currentLevel, gap, weightage }] }`
  (`missingSkills` is the gap analysis — render as "learn this to reach 100%". `gaps` is an alias of the same array.)
- `GET /api/match/:studentId/opportunity/:opportunityId` → single-pair breakdown, same match shape plus `{ studentId, opportunityId }`.

### Applications
- `POST /api/application` body `{ studentId*, opportunityId*, status?, coverLetter? }`, `status` ∈ PENDING \| SHORTLISTED \| SELECTED \| REJECTED (default PENDING) → **201** `{ application: <full row incl. matchScore + appliedAt>, match: <pair breakdown> }`.
  Re-POSTing the same pair **updates** the stored score (upsert) and refreshes SkillGap rows — safe to retry.

### Analytics (admin dashboard)
- `GET /api/analytics/skill-demand?limit=5` → `{ data: [{ skillId, skill, category, demand }] }` (bar chart)
- `GET /api/analytics/placement-rate` → `{ data: [{ department, totalStudents, placedStudents, successRate }] }` (bar chart)
- `GET /api/analytics/avg-skill-gap?role=Backend%20Developer` (`role` required) → `{ role, averageGap (nullable), samples }`
- `GET /api/analytics/progress/:studentId` → `{ studentId, history: [{ recordedAt, overallRating, skillsSnapshot }] }` (line/radar chart; `skillsSnapshot` = `[{ skill, proficiency }]`; may be `[]` for students without history)

## 🚧 PLANNED — DO NOT build frontend for these yet (not implemented)

- `Certification` model (title, provider, linked skill) + certificate points (+8 rule)
- `GET /api/portfolio/:studentId` (Player-Card stats)
- No LLM anywhere in the backend. There is no AI endpoint to call.

Backend will notify when/if these land, with versioned doc updates. Anything not listed in FINALIZED above does not exist.

## Run it locally

```powershell
npm install
npm run db:up     # Postgres 16 (needs DATABASE_URL in .env — ask Aaditya privately)
npm run db:init   # create + sign tables
npm run seed      # demo data (student #4 = 100% showcase: GET /api/match/4)
npm run dev       # API on :4000
```
