import { Router } from "express";
import { skillDemand, placementRate, avgSkillGap, progress } from "../controllers/analyticsController.js";

export const analyticsRoutes = Router();
analyticsRoutes.get("/skill-demand", skillDemand);
analyticsRoutes.get("/placement-rate", placementRate);
analyticsRoutes.get("/avg-skill-gap", avgSkillGap);
analyticsRoutes.get("/progress/:studentId", progress);
