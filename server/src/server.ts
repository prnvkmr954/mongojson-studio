import { app } from "./app.js";
import { config } from "./config.js";
import { closeAllSessions } from "./services/session.service.js";
const server = app.listen(config.PORT, "127.0.0.1", () => console.info(`MongoJSON Studio API listening on http://127.0.0.1:${config.PORT}`));
let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`Received ${signal}; closing MongoDB sessions.`);
  server.close(async () => { await closeAllSessions(); process.exit(0); });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
