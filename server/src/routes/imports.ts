import { Router } from "express";
import { z } from "zod";
import { getSession } from "../services/session.service.js";

export const importRouter = Router();
const payloadSchema = z.object({
  database: z.string().trim().min(1).max(120),
  collection: z.string().trim().min(1).max(120),
  documents: z.array(z.record(z.unknown())).min(1).max(10000)
});
importRouter.post("/", async (request, response) => {
  const id = z.string().min(40).max(128).safeParse(request.header("X-Session-Id"));
  if (!id.success) { response.status(401).json({ message: "Connection session missing or expired. Connect to Atlas again." }); return; }
  const session = getSession(id.data, request.authUser!.id);
  if (!session) { response.status(401).json({ message: "Connection session expired. Connect to Atlas again." }); return; }
  const parsed = payloadSchema.safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ message: "Provide a database, collection, and a JSON array of documents (up to 10,000)." }); return; }
  const { database, collection, documents } = parsed.data;
  if ([database, collection].some(name => name.includes("$") || name.includes(".") || name.includes("/") || name.includes("\\") || /[\u0000-\u001f]/.test(name))) {
    response.status(400).json({ message: "Invalid database or collection name." }); return;
  }
  try {
    const result = await session.client.db(database).collection(collection).insertMany(documents, { ordered: true });
    response.status(201).json({ insertedCount: result.insertedCount, insertedIds: Object.values(result.insertedIds).map(String) });
  } catch (error) {
    const message = error instanceof Error && /duplicate key/i.test(error.message)
      ? "Import stopped because a document has a duplicate _id. Documents inserted before the conflict may already exist."
      : "Import failed. Check collection permissions and the document structure.";
    response.status(400).json({ message });
  }
});
