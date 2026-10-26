import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import { config } from "./config.js";
import { connectionRouter } from "./routes/connections.js";
export const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: config.CLIENT_ORIGIN, methods: ["GET","POST","DELETE","OPTIONS"], allowedHeaders: ["Content-Type","X-Session-Id"] }));
app.use(express.json({ limit: "64kb" }));
app.get("/api/health", (_request, response) => response.json({ status: "ok", service: "mongojson-studio-api" }));
app.use("/api/connections", connectionRouter);
app.use((_request, response) => response.status(404).json({ message: "Endpoint not found." }));
const errors: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  response.status(500).json({ message: config.NODE_ENV === "production" ? "Unexpected server error." : message });
};
app.use(errors);
