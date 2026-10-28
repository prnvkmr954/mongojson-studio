import { app } from "./app.js";
import { config } from "./config.js";
import { closeAllSessions } from "./services/session.service.js";
import { closeAuthStore, initAuthStore } from "./services/auth.service.js";
async function main() {
  await initAuthStore();
  const server = app.listen(config.PORT, process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1", () => console.info(`MongoJSON Studio API listening on http://127.0.0.1:${config.PORT}`));
  let shuttingDown = false;
  async function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.info(`Received ${signal}; closing MongoDB sessions and auth store.`);
    server.close(async () => { await closeAllSessions(); await closeAuthStore(); process.exit(0); });
    setTimeout(() => process.exit(1), 10_000).unref();
  }
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}
main().catch(error => {
  console.error("MongoJSON Studio startup failed. Configure AUTH_MONGODB_URI with a separate persistent application database.", error instanceof Error ? error.message : "Unknown startup error");
  process.exit(1);
});
