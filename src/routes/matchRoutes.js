import { Router } from "express";
import { getMatches, getPairScore } from "../controllers/matchController.js";

export const matchRoutes = Router();
matchRoutes.get("/:studentId", getMatches);
matchRoutes.get("/:studentId/opportunity/:opportunityId", getPairScore);
