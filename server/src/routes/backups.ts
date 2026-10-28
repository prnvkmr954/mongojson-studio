import { Router } from "express";
import multer from "multer";
import { deserialize } from "bson";
import { z } from "zod";
import { getSession } from "../services/session.service.js";
import { config } from "../config.js";

export const backupRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.MAX_UPLOAD_MB * 1024 * 1024, files: 20 } });
const nameSchema = z.string().trim().min(1).max(120).refine(name => !name.includes("$") && !name.includes(".") && !name.includes("/") && !name.includes("\\") && !/[\u0000-\u001f]/.test(name), "Invalid MongoDB name.");
function bsonDocuments(buffer: Buffer): Record<string, unknown>[] {
  const documents: Record<string, unknown>[] = [];
  let offset = 0;
  while (offset < buffer.length) {
    if (buffer.length - offset < 5) throw new Error("BSON file is truncated.");
    const length = buffer.readInt32LE(offset);
    if (length < 5 || offset + length > buffer.length) throw new Error("BSON file contains an invalid or truncated document.");
    const document = deserialize(buffer.subarray(offset, offset + length)) as Record<string, unknown>;
    if (!document || typeof document !== "object" || Array.isArray(document)) throw new Error("BSON entries must be documents.");
    documents.push(document);
    offset += length;
  }
  return documents;
}
function jsonDocuments(buffer: Buffer): Record<string, unknown>[] {
  const parsed: unknown = JSON.parse(buffer.toString("utf8"));
  const documents = Array.isArray(parsed) ? parsed : [parsed];
  if (!documents.length || !documents.every(item => item !== null && typeof item === "object" && !Array.isArray(item))) {
    throw new Error("JSON backup must contain an object or an array of objects.");
  }
  return documents as Record<string, unknown>[];
}
backupRouter.post("/", upload.array("files", 100), async (request, response) => {
  const sessionId = z.string().min(40).max(128).safeParse(request.header("X-Session-Id"));
  if (!sessionId.success) { response.status(401).json({ message: "Connection session missing or expired. Connect to Atlas again." }); return; }
  const session = getSession(sessionId.data, request.authUser!.id);
  if (!session) { response.status(401).json({ message: "Connection session expired. Connect to Atlas again." }); return; }
  const database = nameSchema.safeParse(request.body?.database);
  const mode = z.enum(["collection", "database"]).safeParse(request.body?.mode);
  const collection = nameSchema.safeParse(request.body?.collection);
  const files = (request.files as Express.Multer.File[] | undefined) ?? [];
  if (!database.success || !mode.success || !files.length || (mode.data === "collection" && !collection.success)) {
    response.status(400).json({ message: "Provide a valid database, import mode, destination collection (for collection mode), and at least one backup file." }); return;
  }
  if (mode.data === "collection" && files.some(file => !/\.(json|bson)$/i.test(file.originalname))) {
    response.status(400).json({ message: "Collection backup files must use .json or .bson extensions." }); return;
  }
  if (files.some(file => !/\.(json|bson)$/i.test(file.originalname))) {
    response.status(400).json({ message: "Only .json and .bson files are supported. For a mongodump folder, select its collection files; ZIP archives and .archive files are not supported yet." }); return;
  }
  const summaries: Array<{file:string;collection:string;insertedCount:number}> = [];
  try {
    for (const file of files) {
      const targetCollection = mode.data === "collection" ? collection.data! : file.originalname.replace(/\.(json|bson)$/i, "");
      const validName = nameSchema.safeParse(targetCollection);
      if (!validName.success) throw new Error("File name does not map to a valid MongoDB collection: " + file.originalname);
      const documents = /\.bson$/i.test(file.originalname) ? bsonDocuments(file.buffer) : jsonDocuments(file.buffer);
      let insertedCount = 0;
      for (let offset = 0; offset < documents.length; offset += 500) {
        const batch = documents.slice(offset, offset + 500);
        const result = await session.client.db(database.data).collection(validName.data).insertMany(batch, { ordered: true });
        insertedCount += result.insertedCount;
      }
      summaries.push({ file: file.originalname, collection: validName.data, insertedCount });
    }
    response.status(201).json({ database: database.data, mode: mode.data, filesProcessed: summaries.length, insertedCount: summaries.reduce((sum, item) => sum + item.insertedCount, 0), collections: summaries });
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : "Backup import failed.", partialResults: summaries });
  }
});
