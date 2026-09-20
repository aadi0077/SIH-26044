// ─── Player-Card portfolio ("video-game stats") ──────────────────────────────
// Deterministic, fully explainable — no LLM. Every point traces to a row.
//
// Dimension score (0-100):
//   score = 100 × (0.6 × avgProficiency/10 + 0.4 × coverage)
//           + min(16, 8 × certifiedSkills)      ← certificate points
//           + min(10, 5 × projectMentions)      ← project proof
//   capped at 100.
//
//   - avgProficiency: mean proficiency of the student's OWNED skills in the
//     dimension (0 when none owned). Rewards depth.
//   - coverage: owned ÷ defined skills in the dimension. Rewards breadth.
//   - certifiedSkills: distinct dimension skills backed by a Certification
//     row (+8 each — "did a course, get points").
//   - projectMentions: student projects whose text names a dimension skill.
//
// Overall (OVR) = rounded mean of the 6 dimensions.
// Grades: S ≥ 85, A ≥ 70, B ≥ 55, C ≥ 40, else D.
// Titles: Legend ≥ 85, Elite ≥ 70, Pro ≥ 55, Challenger ≥ 40, else Rookie.

import { db } from "../prisma/db.ts";
import { getTopMatchesForStudent } from "./matchingService.js";

export const CERT_POINTS_PER_SKILL = 8;
export const CERT_POINTS_CAP_PER_DIMENSION = 16;
export const PROJECT_POINTS_PER_MENTION = 5;
export const PROJECT_POINTS_CAP_PER_DIMENSION = 10;

// Every rated skill belongs to exactly one dimension (27 total).
export const DIMENSIONS = [
  { key: "frontend", label: "Frontend", skills: ["React", "TypeScript", "JavaScript", "Figma"] },
  { key: "backend", label: "Backend", skills: ["Node.js", "Express", "REST APIs", "PostgreSQL", "MongoDB", "GraphQL"] },
  { key: "data_ai", label: "Data & AI", skills: ["Python", "Machine Learning", "Deep Learning", "TensorFlow", "Data Analysis", "Power BI", "Excel"] },
  { key: "devops", label: "DevOps & Cloud", skills: ["Docker", "Kubernetes", "AWS", "CI/CD", "Linux", "Git"] },
  { key: "core_cs", label: "Core CS", skills: ["Java", "C++"] },
  { key: "soft", label: "Soft Skills", skills: ["Communication", "Teamwork"] },
];

const SKILL_TO_DIMENSION = new Map();
for (const dim of DIMENSIONS) for (const s of dim.skills) SKILL_TO_DIMENSION.set(s, dim.key);

/**
 * Pure portfolio core — no DB access (seed/tests reuse it).
 *
 * @param {object} args
 * @param {Array<{skill:string, proficiency:number}>} args.skills
 * @param {string[]} args.projects
 * @param {Array<{skill:string, title:string, provider:string}>} args.certifications
 * @param {Array<{skill:string, gap:number, weightage:number}>} args.topMatchGaps gaps from the student's #1 opportunity
 */
export function buildPortfolio({ skills = [], proficiencies, projects = [], certifications = [], topMatchGaps = [] }) {
  // Back-compat: accept either `skills:[{skill,proficiency}]` or legacy map.
  const profBySkill = new Map();
  if (proficiencies instanceof Map) {
    for (const [k, v] of proficiencies) profBySkill.set(k, v);
  }
  for (const s of skills) profBySkill.set(s.skill ?? s.name, s.proficiency);

  const certSkills = new Set(certifications.map((c) => c.skill));
  const haystacks = projects.map((p) => String(p).toLowerCase());

  const dimensions = DIMENSIONS.map((dim) => {
    const owned = dim.skills
      .filter((name) => profBySkill.has(name))
      .map((name) => ({ skill: name, proficiency: profBySkill.get(name) }));
    const avgProf = owned.length === 0 ? 0 : owned.reduce((a, s) => a + s.proficiency, 0) / owned.length;
    const coverage = owned.length / dim.skills.length;

    const certified = dim.skills.filter((name) => certSkills.has(name));
    const certPoints = Math.min(CERT_POINTS_CAP_PER_DIMENSION, certified.length * CERT_POINTS_PER_SKILL);

    const lowered = dim.skills.map((s) => s.toLowerCase());
    let mentions = 0;
    for (const text of haystacks) {
      if (lowered.some((kw) => kw && text.includes(kw))) mentions += 1;
    }
    const projectPoints = Math.min(PROJECT_POINTS_CAP_PER_DIMENSION, mentions * PROJECT_POINTS_PER_MENTION);

    const score = Math.min(100, Math.round(100 * (0.6 * (avgProf / 10) + 0.4 * coverage) + certPoints + projectPoints));

    return {
      key: dim.key,
      label: dim.label,
      score,
      grade: gradeFor(score),
      owned: owned.length,
      total: dim.skills.length,
      skills: owned.sort((a, b) => b.proficiency - a.proficiency),
      certifications: certifications
        .filter((c) => dim.skills.includes(c.skill))
        .map((c) => ({ skill: c.skill, title: c.title, provider: c.provider })),
      projectMentions: mentions,
      breakdown: {
        base: Math.round(100 * (0.6 * (avgProf / 10) + 0.4 * coverage)),
        certificatePoints: certPoints,
        projectPoints,
      },
    };
  });

  const overall = Math.round(dimensions.reduce((a, d) => a + d.score, 0) / dimensions.length);
  const best = [...dimensions].sort((a, b) => b.score - a.score)[0];

  const strengths = [...profBySkill.entries()]
    .map(([skill, proficiency]) => ({ skill, proficiency, dimension: SKILL_TO_DIMENSION.get(skill) ?? null }))
    .sort((a, b) => b.proficiency - a.proficiency)
    .slice(0, 3);

  // "Next unlock" quests: heaviest gaps of the student's #1 match.
  const nextUnlocks = [...topMatchGaps]
    .sort((a, b) => b.weightage - a.weightage)
    .slice(0, 3)
    .map((g) => ({ skill: g.skill, gap: g.gap, quest: `Learn ${g.skill} to close a ${g.gap}-point gap on your top match` }));

  return {
    overall,
    level: Math.min(10, Math.floor(overall / 10) + 1),
    title: titleFor(overall),
    class: `${best.label} Specialist`,
    dimensions,
    strengths,
    nextUnlocks,
  };
}

/** Full portfolio for a student, loaded from the DB. */
export async function getPortfolio(studentId) {
  const student = await db.orm.public.Student.where({ id: studentId }).first();
  if (!student) {
    const err = new Error(`Student ${studentId} not found`);
    err.status = 404;
    throw err;
  }

  const [studentSkills, certifications] = await Promise.all([
    db.orm.public.StudentSkill.where({ studentId }).include("skill").all(),
    db.orm.public.Certification.where({ studentId }).include("skill").all(),
  ]);

  let topMatchGaps = [];
  try {
    const top = await getTopMatchesForStudent(studentId, 1);
    topMatchGaps = top.matches[0]?.gaps ?? [];
  } catch {
    topMatchGaps = []; // portfolio survives even with zero open opportunities
  }

  return {
    student: {
      id: student.id,
      name: student.name,
      department: student.department,
      cgpa: student.cgpa,
      targetRole: student.targetRole,
    },
    ...buildPortfolio({
      skills: studentSkills.map((s) => ({ skill: s.skill.name, proficiency: s.proficiency })),
      projects: student.projects ?? [],
      certifications: certifications.map((c) => ({
        skill: c.skill.name,
        title: c.title,
        provider: c.provider,
      })),
      topMatchGaps,
    }),
  };
}

function gradeFor(score) {
  if (score >= 85) return "S";
  if (score >= 70) return "A";
  if (score >= 55) return "B";
  if (score >= 40) return "C";
  return "D";
}

function titleFor(overall) {
  if (overall >= 85) return "Legend";
  if (overall >= 70) return "Elite";
  if (overall >= 55) return "Pro";
  if (overall >= 40) return "Challenger";
  return "Rookie";
}
