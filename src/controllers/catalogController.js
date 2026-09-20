import { db } from "../prisma/db.ts";

// Small read-only catalog for the demo UI (student picker, opportunity list).
export async function listStudents(_req, res, next) {
  try {
    res.json({
      data: await db.orm.public.Student
        .select("id", "name", "email", "department", "cgpa", "targetRole")
        .orderBy((s) => s.id.asc())
        .all(),
    });
  } catch (err) {
    next(err);
  }
}

export async function listOpportunities(_req, res, next) {
  try {
    const rows = await db.orm.public.Opportunity
      .where({ isOpen: true })
      .include("industry")
      .orderBy((o) => o.id.asc())
      .all();
    res.json({
      data: rows.map((o) => ({
        id: o.id,
        title: o.title,
        type: o.type,
        targetRole: o.targetRole,
        minCgpa: o.minCgpa,
        industry: o.industry?.name ?? null,
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function listSkills(_req, res, next) {
  try {
    res.json({
      data: await db.orm.public.Skill.orderBy((s) => s.name.asc()).all(),
    });
  } catch (err) {
    next(err);
  }
}
