import { Router } from "express";
import { createApplication } from "../controllers/applicationController.js";

export const applicationRoutes = Router();
applicationRoutes.post("/", createApplication);
