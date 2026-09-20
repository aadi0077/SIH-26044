// ─── Analytics aggregations for the Admin Dashboard ──────────────────────────
// All queries are pushed to Postgres (GROUP BY / AVG in the database) and
// only small result sets are post-processed in JS.

import { db } from "../prisma/db.ts";
import { config } from "../config.js";

/**
 * "Top N In-Demand Skills": count how many OPEN opportunities require each
 * skill. Returns chart-ready data: [{ skillId, skill, category, demand }].
 */
export async function getTopInDemandSkills(limit = config.analytics.defaultSkillDemandLimit) {
  // Open opportunity ids first (keeps the GROUP BY scan to relevant rows).
  const openOpps = await db.orm.public.Opportunity.where({ isOpen: true }).select("id").all();
  const openIds = openOpps.map((o) => o.id);
  if (openIds.length === 0) return [];

  const groups = await db.orm.public.OpportunitySkill
    .where((s) => s.opportunityId.in(openIds))
    .groupBy("skillId")
    .aggregate((agg) => ({ demand: agg.count() }));

  groups.sort((a, b) => b.demand - a.demand);
  const top = groups.slice(0, limit);

  const skills = await db.orm.public.Skill
    .where((s) => s.id.in(top.map((t) => t.skillId)))
    .all();
  const byId = new Map(skills.map((s) => [s.id, s]));

  return top.map((t) => ({
    skillId: t.skillId,
    skill: byId.get(t.skillId)?.name ?? `#${t.skillId}`,
    category: byId.get(t.skillId)?.category ?? null,
    demand: t.demand,
  }));
}

/**
 * "Placement Success Rate" per department:
 *   placed  = distinct students with >= 1 SELECTED application
 *   rate    = 100 * placed / total students in the department
 */
export async function getPlacementSuccessRate() {
  const [students, selectedApps] = await Promise.all([
    db.orm.public.Student.select("id", "department").all(),
    db.orm.public.Application.where({ status: "SELECTED" }).select("studentId").all(),
  ]);

  const deptOf = new Map(students.map((s) => [s.id, s.department]));
  const totals = new Map(); // dept -> student count
  for (const s of students) totals.set(s.department, (totals.get(s.department) ?? 0) + 1);

  const placedByDept = new Map(); // dept -> Set<studentId>
  for (const app of selectedApps) {
    const dept = deptOf.get(app.studentId);
    if (!dept) continue; // application whose student was deleted
    if (!placedByDept.has(dept)) placedByDept.set(dept, new Set());
    placedByDept.get(dept).add(app.studentId);
  }

  return [...totals.entries()]
    .map(([department, totalStudents]) => {
      const placedStudents = placedByDept.get(department)?.size ?? 0;
      return {
        department,
        totalStudents,
        placedStudents,
        successRate: totalStudents === 0 ? 0 : Math.round((placedStudents / totalStudents) * 10000) / 100,
      };
    })
    .sort((a, b) => b.successRate - a.successRate);
}

/**
 * "Average Skill Gap" for a job role: AVG(SkillGap.gapSize) over all stored
 * gap rows whose opportunity targets that role. `role` matches
 * Opportunity.targetRole exactly (seed + API use a controlled vocabulary).
 */
export async function getAverageSkillGapForRole(role) {
  const opps = await db.orm.public.Opportunity.where({ targetRole: role }).select("id").all();
  const oppIds = opps.map((o) => o.id);
  if (oppIds.length === 0) return { role, averageGap: null, samples: 0 };

  const [agg, sampleCount] = await Promise.all([
    db.orm.public.SkillGap
      .where((s) => s.opportunityId.in(oppIds))
      .aggregate((a) => ({ avgGap: a.avg("gapSize") })),
    db.orm.public.SkillGap
      .where((s) => s.opportunityId.in(oppIds))
      .aggregate((a) => ({ n: a.count() })),
  ]);

  return {
    role,
    averageGap: agg.avgGap === null ? null : Math.round(agg.avgGap * 100) / 100,
    samples: sampleCount.n,
  };
}

/**
 * Student skill progress over time (growth-curve chart data), oldest first.
 */
export async function getStudentSkillProgress(studentId) {
  const rows = await db.orm.public.SkillHistory
    .where({ studentId })
    .orderBy((h) => h.recordedAt.asc())
    .all();
  return rows.map((r) => ({
    recordedAt: r.recordedAt,
    overallRating: r.overallRating,
    skillsSnapshot: r.skillsSnapshot,
  }));
}
