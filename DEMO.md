# SIH 2026 PS-26044 — Backend Module (Aaditya Gade)
### Database + Skill Matching Engine + Analytics — PostgreSQL + JavaScript

> All outputs below are **captured from the live system** (Postgres 16 in Docker + Express API), not mockups.

## 1. What was delivered

| File | Purpose |
|---|---|
| `src/prisma/contract.prisma` | Data contract: Student, Industry, Opportunity, Skill, StudentSkill, OpportunitySkill, Application, SkillGap, SkillHistory (emitted to `contract.json`/`contract.d.ts`) |
| `prisma/schema.prisma` | Classic-Prisma mirror of the same schema (reference) |
| `src/services/matchingService.js` | Smart Match engine: weighted score, CGPA/project bonuses, gap analysis |
| `src/services/analyticsService.js` | Dashboard aggregations (in-demand skills, placement rate, avg gap, progress) |
| `src/controllers/` + `src/routes/` + `src/server.js` | REST API on `http://localhost:4000` |
| `seed.js` | Demo data: 50 students, 20 opportunities, scores pre-calculated by the real engine |
| `docker-compose.yml` | One-command Postgres 16 (`npm run db:up`) |

## 2. The matching formula (explainable, no black box)

```
base  = 100 × Σ(min(proficiency,10) × weightage) / Σ(10 × weightage)
score = min(100, base + cgpaBonus + projectBonus)
```

- CGPA bonus: +3 meets `minCgpa`, +5 exceeds it by ≥ 1.0
- Project bonus: +2 per project mentioning a matched skill/role (cap +5)
- Every required skill below its bar is returned in `missing_skills` with required/current/gap

## 3. Live database contents (verified `2026-09-20`)

| Table | Rows |
|---|---|
| Skill | 27 |
| Student | 50 |
| Industry | 6 |
| Opportunity | 20 |
| StudentSkill | 300 |
| OpportunitySkill | 79 |
| Application | 101 (100 seeded + 1 via POST test) |
| SkillGap | 284 |
| SkillHistory | 36 |

## 4. Verified API outputs (live)

**`GET /api/match/4` — top 5, sorted:**
- 100% — Node.js Developer Intern (base 94.15 + 8 bonus, 0 missing skills)
- 96.92% — API Engineer
- 94.25% — Backend Developer
- 79.19% — MERN Stack Intern (missing: React, gap 6)
- 63.18% — Software Engineer Trainee (missing: TypeScript, gap 5)

**`GET /api/analytics/skill-demand`:** PostgreSQL 7, Python 7, Git 6, TypeScript 6, Data Analysis 5 (open opportunities each).

**`GET /api/analytics/placement-rate`:** CSE 2/6 = 33.33%, ECE 2/8 = 25%, IT 2/9 = 22.22%, EEE 2/12 = 16.67%, MECH 2/15 = 13.33%.

**`POST /api/application` `{"studentId":7,"opportunityId":15}` → 201:** stored `matchScore` equals computed score; SkillGap rows refreshed (3 saved).

**`GET /api/analytics/avg-skill-gap?role=Backend Developer`:** averageGap 4.57 over 72 samples.

## 5. Reproduce it (teammate quickstart)

```powershell
npm install
npm run db:up     # Postgres 16 container (credentials in .env — ask Aaditya)
npm run db:init   # creates + signs all 9 tables from the contract
npm run seed      # demo dataset with pre-calculated match scores
npm run dev       # API on http://localhost:4000
curl http://localhost:4000/api/match/4   # the 100% showcase student
```

## 6. Judge demo script (60 seconds)

1. `GET /api/students` → pick any student.
2. `GET /api/match/<id>` → top match with score breakdown + `missing_skills`.
3. Point at the gap: *"To reach 100%, learn React (gap 6)."* 
4. `GET /api/analytics/skill-demand` → *"…which is exactly what the market chart says is in demand."*
5. `POST /api/application` → *"Applying stores the score snapshot permanently."*
