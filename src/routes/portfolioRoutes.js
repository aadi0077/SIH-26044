import { Router } from "express";
import { portfolio } from "../controllers/portfolioController.js";

export const portfolioRoutes = Router();
portfolioRoutes.get("/:studentId", portfolio);
