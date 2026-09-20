import { getTopMatchesForStudent, calculateMatchScore } from "../services/matchingService.js";

// GET /api/match/:studentId?limit=5 — top opportunities sorted by score.
export async function getMatches(req, res, next) {
  try {
    const studentId = Number(req.params.studentId);
    if (!Number.isInteger(studentId)) {
      return res.status(400).json({ error: "studentId must be an integer" });
    }
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    res.json(await getTopMatchesForStudent(studentId, limit));
  } catch (err) {
    next(err);
  }
}

// GET /api/match/:studentId/opportunity/:opportunityId — full breakdown for one pair.
export async function getPairScore(req, res, next) {
  try {
    const studentId = Number(req.params.studentId);
    const opportunityId = Number(req.params.opportunityId);
    if (!Number.isInteger(studentId) || !Number.isInteger(opportunityId)) {
      return res.status(400).json({ error: "studentId and opportunityId must be integers" });
    }
    res.json(await calculateMatchScore(studentId, opportunityId));
  } catch (err) {
    next(err);
  }
}
