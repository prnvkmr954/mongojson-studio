import { Router } from "express";
import { z } from "zod";
import { getSession } from "../services/session.service.js";

export const destinationRouter = Router();
const sessionIdSchema = z.string().min(40).max(128);
const nameSchema = z.string().trim().min(1).max(120).regex(/^[^.$\u0000-\u001f/\\]+$/, "Use a valid MongoDB name.");
function sessionFrom(request: import("express").Request, response: import("express").Response) {
  const parsed = sessionIdSchema.safeParse(request.header("X-Session-Id"));
  if (!parsed.success) { response.status(401).json({ message: "Connection session missing or expired. Connect to Atlas again." }); return null; }
  const session = getSession(parsed.data);
  if (!session) { response.status(401).json({ message: "Connection session expired. Connect to Atlas again." }); return null; }
  return session;
}
destinationRouter.get("/databases", async (request, response) => {
  const session = sessionFrom(request, response); if (!session) return;
  try {
    const result = await session.client.db("admin").admin().listDatabases({ nameOnly: true });
    response.json({ databases: result.databases.map(db => db.name).filter(Boolean).sort() });
  } catch { response.status(400).json({ message: "Could not list databases. Check database user permissions." }); }
});
destinationRouter.get("/collections", async (request, response) => {
  const session = sessionFrom(request, response); if (!session) return;
  const parsed = nameSchema.safeParse(request.query.database);
  if (!parsed.success) { response.status(400).json({ message: "A valid database name is required." }); return; }
  try { response.json({ collections: await session.client.db(parsed.data).listCollections({}, { nameOnly: true }).toArray().then(items => items.map(item => item.name).sort()) }); }
  catch { response.status(400).json({ message: "Could not list collections. Check database user permissions." }); }
});
destinationRouter.post("/databases", async (request, response) => {
  const session = sessionFrom(request, response); if (!session) return;
  const parsed = nameSchema.safeParse(request.body?.database);
  if (!parsed.success) { response.status(400).json({ message: "Enter a valid database name." }); return; }
  try {
    const db = session.client.db(parsed.data);
    await db.createCollection("_mongojson_studio_init");
    await db.collection("_mongojson_studio_init").drop();
    response.status(201).json({ database: parsed.data });
  } catch { response.status(400).json({ message: "Could not create database. MongoDB creates it when the first collection is created." }); }
});
destinationRouter.post("/collections", async (request, response) => {
  const session = sessionFrom(request, response); if (!session) return;
  const db = nameSchema.safeParse(request.body?.database);
  const collection = nameSchema.safeParse(request.body?.collection);
  if (!db.success || !collection.success) { response.status(400).json({ message: "Enter valid database and collection names." }); return; }
  try { await session.client.db(db.data).createCollection(collection.data); response.status(201).json({ collection: collection.data }); }
  catch { response.status(400).json({ message: "Could not create collection. It may already exist or your user may lack permission." }); }
});
