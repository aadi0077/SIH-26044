// ─── Smart Match engine ──────────────────────────────────────────────────────
// Scores how well a student fits an opportunity using a WEIGHTED formula —
// not a naive count of matching skill tags.
//
// Math (all numbers 0-100 unless noted):
//   For each required skill r with weightage w and required level L, and the
//   student's proficiency p in that skill (p = 0 when the student lacks it):
//
//     contribution(r) = min(p, 10) * w
//     denominator(r)  = 10 * w
//
//     baseScore = 100 * SUM(contribution) / SUM(denominator)
//
//   So a high-weightage skill moves the score far more than a low-weightage
//   one, and partial proficiency earns partial credit instead of 0/1.
//
//   Bonuses (config-driven, see src/config.js):
//     + cgpaBonus      if student.cgpa >= opportunity.minCgpa
//     + projectBonus   +2 per student project whose text mentions a matched
//                      skill (or the opportunity's target role), capped at +5
//
//   finalScore = min(100, round2(baseScore + bonuses))
//
// Gap analysis: every required skill with p < L is reported with
// requiredLevel / currentLevel / gap (= L - p) so the student knows exactly
// what to learn to reach 100%.

import { db } from "../prisma/db.ts";
import { config } from "../config.js";

const { maxProficiency, cgpaBonusMet, cgpaBonusExceededBy, cgpaBonusExceeded,
  projectBonusPerProject, projectBonusCap, defaultTopN } = config.matching;

/**
 * Pure scoring core — no DB access, so seed.js and unit tests can reuse it.
 *
 * @param {object} args
 * @param {number} args.studentCgpa
 * @param {string[]} args.studentProjects
 * @param {Map<number, number>} args.proficiencyBySkillId  skillId -> proficiency (1-10)
 * @param {Array<{skillId:number, skillName:string, weightage:number, minProficiency:number}>} args.requirements
 * @param {number} args.minCgpa
 * @param {string|null} args.targetRole
 */
export function scorePair({
  studentCgpa,
  studentProjects = [],
  proficiencyBySkillId,
  requirements,
  minCgpa = 0,
  targetRole = null,
}) {
  let weightedSum = 0;
  let totalWeight = 0;
  const matchedSkills = [];
  const missingSkills = [];

  for (const req of requirements) {
    const proficiency = proficiencyBySkillId.get(req.skillId) ?? 0;
    weightedSum += Math.min(proficiency, maxProficiency) * req.weightage;
    totalWeight += maxProficiency * req.weightage;

    if (proficiency >= req.minProficiency) {
      matchedSkills.push({
        skillId: req.skillId,
        skill: req.skillName,
        proficiency,
        requiredLevel: req.minProficiency,
        weightage: req.weightage,
      });
    } else {
      // Absent (proficiency 0) or below the required bar — both block 100%.
      missingSkills.push({
        skillId: req.skillId,
        skill: req.skillName,
        requiredLevel: req.minProficiency,
        currentLevel: proficiency,
        gap: req.minProficiency - proficiency,
        weightage: req.weightage,
      });
    }
  }

  // Heaviest gaps first — most impactful thing to learn next.
  missingSkills.sort((a, b) => b.weightage - a.weightage);

  const baseScore = totalWeight === 0 ? 0 : (weightedSum / totalWeight) * 100;

  // — Bonus 1: CGPA meets / exceeds the opportunity bar —
  let cgpaBonus = 0;
  if (minCgpa > 0 && studentCgpa >= minCgpa) {
    cgpaBonus = studentCgpa >= minCgpa + cgpaBonusExceededBy ? cgpaBonusExceeded : cgpaBonusMet;
  }

  // — Bonus 2: relevant projects (text match against matched skills / role) —
  const haystacks = studentProjects.map((p) => p.toLowerCase());
  const keywords = new Set(
    matchedSkills.map((s) => s.skill.toLowerCase()),
  );
  if (targetRole) keywords.add(targetRole.toLowerCase());
  let relevantProjects = 0;
  for (const text of haystacks) {
    for (const kw of keywords) {
      if (kw && text.includes(kw)) { relevantProjects += 1; break; }
    }
  }
  const projectBonus = Math.min(relevantProjects * projectBonusPerProject, projectBonusCap);

  const score = Math.min(100, round2(baseScore + cgpaBonus + projectBonus));

  return {
    score,
    baseScore: round2(baseScore),
    bonuses: { cgpa: cgpaBonus, projects: projectBonus, total: cgpaBonus + projectBonus },
    matchedSkills,
    // Alias required by the API contract: everything needed to reach 100%.
    missingSkills,
    gaps: missingSkills,
  };
}

/**
 * Score one (student, opportunity) pair, loading everything from the DB.
 * Returns the full breakdown including gap analysis.
 */
export async function calculateMatchScore(studentId, opportunityId) {
  const student = await db.orm.public.Student.where({ id: studentId }).first();
  if (!student) {
    const err = new Error(`Student ${studentId} not found`);
    err.status = 404;
    throw err;
  }
  const opportunity = await db.orm.public.Opportunity.where({ id: opportunityId }).first();
  if (!opportunity) {
    const err = new Error(`Opportunity ${opportunityId} not found`);
    err.status = 404;
    throw err;
  }

  const [studentSkills, requirements] = await Promise.all([
    db.orm.public.StudentSkill.where({ studentId }).all(),
    db.orm.public.OpportunitySkill.where({ opportunityId }).include("skill").all(),
  ]);

  const proficiencyBySkillId = new Map(studentSkills.map((s) => [s.skillId, s.proficiency]));

  const result = scorePair({
    studentCgpa: student.cgpa,
    studentProjects: student.projects ?? [],
    proficiencyBySkillId,
    requirements: requirements.map((r) => ({
      skillId: r.skillId,
      skillName: r.skill.name,
      weightage: r.weightage,
      minProficiency: r.minProficiency,
    })),
    minCgpa: opportunity.minCgpa,
    targetRole: opportunity.targetRole,
  });

  return {
    studentId,
    opportunityId,
    opportunity: {
      id: opportunity.id,
      title: opportunity.title,
      type: opportunity.type,
      targetRole: opportunity.targetRole,
    },
    ...result,
  };
}

/**
 * Top-N open opportunities for a student, sorted by score desc.
 * Two batched reads (open opps + all their requirements) + in-memory scoring,
 * so this stays fast without N+1 queries.
 */
export async function getTopMatchesForStudent(studentId, limit = defaultTopN) {
  const student = await db.orm.public.Student.where({ id: studentId }).first();
  if (!student) {
    const err = new Error(`Student ${studentId} not found`);
    err.status = 404;
    throw err;
  }

  const [studentSkills, opportunities, allRequirements] = await Promise.all([
    db.orm.public.StudentSkill.where({ studentId }).all(),
    db.orm.public.Opportunity.where({ isOpen: true }).all(),
    db.orm.public.OpportunitySkill.include("skill").all(),
  ]);

  const proficiencyBySkillId = new Map(studentSkills.map((s) => [s.skillId, s.proficiency]));
  const reqsByOpp = new Map();
  for (const r of allRequirements) {
    if (!reqsByOpp.has(r.opportunityId)) reqsByOpp.set(r.opportunityId, []);
    reqsByOpp.get(r.opportunityId).push({
      skillId: r.skillId,
      skillName: r.skill.name,
      weightage: r.weightage,
      minProficiency: r.minProficiency,
    });
  }

  const scored = opportunities.map((opp) => ({
    opportunityId: opp.id,
    opportunity: {
      id: opp.id,
      title: opp.title,
      type: opp.type,
      targetRole: opp.targetRole,
      minCgpa: opp.minCgpa,
    },
    ...scorePair({
      studentCgpa: student.cgpa,
      studentProjects: student.projects ?? [],
      proficiencyBySkillId,
      requirements: reqsByOpp.get(opp.id) ?? [],
      minCgpa: opp.minCgpa,
      targetRole: opp.targetRole,
    }),
  }));

  scored.sort((a, b) => b.score - a.score);
  return { studentId, matches: scored.slice(0, limit) };
}

/**
 * Persist a match: upsert the Application (snapshot the score) and refresh
 * the student's SkillGap rows for that opportunity.
 */
export async function persistMatchResult(studentId, opportunityId, { status, coverLetter } = {}) {
  const result = await calculateMatchScore(studentId, opportunityId);

  const application = await db.orm.public.Application.upsert({
    create: {
      studentId,
      opportunityId,
      matchScore: result.score,
      ...(status ? { status } : {}),
      ...(coverLetter ? { coverLetter } : {}),
    },
    update: { matchScore: result.score },
    conflictOn: { studentId, opportunityId },
  });

  // Refresh gaps: delete stale rows, insert the fresh analysis.
  await db.orm.public.SkillGap.where({ studentId })
    .where((s) => s.opportunityId.eq(opportunityId))
    .deleteAll();
  if (result.gaps.length > 0) {
    await db.orm.public.SkillGap.createAll(
      result.gaps.map((g) => ({
        studentId,
        opportunityId,
        skillId: g.skillId,
        requiredLevel: g.requiredLevel,
        currentLevel: g.currentLevel,
        gapSize: g.gap,
      })),
    );
  }

  return { application, match: result };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
