import { persistMatchResult } from "../services/matchingService.js";

// POST /api/application { studentId, opportunityId, status?, coverLetter? }
// Scores the pair with the Smart Match engine and stores the application
// with the calculated matchScore (+ refreshes SkillGap rows).
export async function createApplication(req, res, next) {
  try {
    const { studentId, opportunityId, status, coverLetter } = req.body ?? {};
    if (!Number.isInteger(studentId) || !Number.isInteger(opportunityId)) {
      return res.status(400).json({ error: "studentId and opportunityId must be integers" });
    }
    if (status && !["PENDING", "SHORTLISTED", "SELECTED", "REJECTED"].includes(status)) {
      return res.status(400).json({ error: "invalid status" });
    }
    const result = await persistMatchResult(studentId, opportunityId, { status, coverLetter });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}
