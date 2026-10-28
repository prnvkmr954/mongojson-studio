import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { connectionRouter } from "./routes/connections.js";
import { destinationRouter } from "./routes/destinations.js";
import { importRouter } from "./routes/imports.js";
import { backupRouter } from "./routes/backups.js";
import { authRouter } from "./routes/auth.js";
import { requireAuth, requireSameOrigin } from "./middleware/auth.js";
export const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: config.CLIENT_ORIGIN, methods: ["GET","POST","DELETE","OPTIONS"], allowedHeaders: ["Content-Type","X-Session-Id"] }));
app.use(express.json({ limit: `${config.MAX_UPLOAD_MB}mb` }));
app.use("/api", requireSameOrigin);
app.get("/api/health", (_request, response) => response.json({ status: "ok", service: "mongojson-studio-api" }));
app.use("/api/auth", authRouter);
app.use("/api/connections", requireAuth, connectionRouter);
app.use("/api/destinations", requireAuth, destinationRouter);
app.use("/api/imports", requireAuth, importRouter);
app.use("/api/imports/backup", requireAuth, backupRouter);
app.use("/api", (_request, response) => response.status(404).json({ message: "Endpoint not found." }));
if (config.NODE_ENV === "production") {
  const clientDist = resolve(dirname(fileURLToPath(import.meta.url)), "../../client/dist");
  app.use(express.static(clientDist, { index: false }));
  app.get("*", (_request, response, next) => {
    const indexFile = resolve(clientDist, "index.html");
    if (existsSync(indexFile)) response.sendFile(indexFile);
    else next();
  });
}
app.use((_request, response) => response.status(404).json({ message: "Endpoint not found." }));
const errors: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  response.status(500).json({ message: config.NODE_ENV === "production" ? "Unexpected server error." : message });
};
app.use(errors);
