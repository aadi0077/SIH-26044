import {
  getTopInDemandSkills,
  getPlacementSuccessRate,
  getAverageSkillGapForRole,
  getStudentSkillProgress,
} from "../services/analyticsService.js";

// GET /api/analytics/skill-demand?limit=5 — chart data.
export async function skillDemand(req, res, next) {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    res.json({ data: await getTopInDemandSkills(limit) });
  } catch (err) {
    next(err);
  }
}

// GET /api/analytics/placement-rate
export async function placementRate(_req, res, next) {
  try {
    res.json({ data: await getPlacementSuccessRate() });
  } catch (err) {
    next(err);
  }
}

// GET /api/analytics/avg-skill-gap?role=Backend%20Developer
export async function avgSkillGap(req, res, next) {
  try {
    const { role } = req.query;
    if (!role) return res.status(400).json({ error: "query param 'role' is required" });
    res.json(await getAverageSkillGapForRole(role));
  } catch (err) {
    next(err);
  }
}

// GET /api/analytics/progress/:studentId — growth curve data.
export async function progress(req, res, next) {
  try {
    const studentId = Number(req.params.studentId);
    if (!Number.isInteger(studentId)) {
      return res.status(400).json({ error: "studentId must be an integer" });
    }
    res.json({ studentId, history: await getStudentSkillProgress(studentId) });
  } catch (err) {
    next(err);
  }
}
