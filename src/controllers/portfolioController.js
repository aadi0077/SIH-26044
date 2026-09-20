import { getPortfolio } from "../services/portfolioService.js";

// GET /api/portfolio/:studentId — video-game-style stat card.
export async function portfolio(req, res, next) {
  try {
    const studentId = Number(req.params.studentId);
    if (!Number.isInteger(studentId)) {
      return res.status(400).json({ error: "studentId must be an integer" });
    }
    res.json(await getPortfolio(studentId));
  } catch (err) {
    next(err);
  }
}
