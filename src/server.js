import "dotenv/config";
import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { matchRoutes } from "./routes/matchRoutes.js";
import { analyticsRoutes } from "./routes/analyticsRoutes.js";
import { applicationRoutes } from "./routes/applicationRoutes.js";
import { catalogRoutes } from "./routes/catalogRoutes.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true, service: "sih-26044-matching" }));

app.use("/api/match", matchRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/application", applicationRoutes);
app.use("/api", catalogRoutes);

// 404 + centralized error handler (err.status from services => HTTP code).
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status ?? 500).json({ error: err.message ?? "Internal server error" });
});
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

app.listen(config.port, () => {
  console.log(`SIH-26044 backend listening on http://localhost:${config.port}`);
});
