import { Router } from "express";
import { listStudents, listOpportunities, listSkills } from "../controllers/catalogController.js";

export const catalogRoutes = Router();
catalogRoutes.get("/students", listStudents);
catalogRoutes.get("/opportunities", listOpportunities);
catalogRoutes.get("/skills", listSkills);
