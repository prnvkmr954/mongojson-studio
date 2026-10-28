import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { MongoClient, ObjectId, type Collection, type ObjectId as ObjectIdType } from "mongodb";
import { config } from "../config.js";
const scrypt = promisify(scryptCallback);
type User = { _id?: ObjectId; email: string; passwordHash: string; createdAt: Date };
type AuthSession = { _id?: ObjectIdType; tokenHash: string; userId: ObjectIdType; expiresAt: Date; createdAt: Date };
let client: MongoClient | null = null;
let users: Collection<User> | null = null;
let sessions: Collection<AuthSession> | null = null;
export async function initAuthStore() {
  if (!config.AUTH_MONGODB_URI) throw new Error("AUTH_MONGODB_URI is required. Configure a separate MongoDB database for MongoJSON Studio accounts.");
  client = new MongoClient(config.AUTH_MONGODB_URI, { appName: "MongoJSON-Studio-Auth", serverSelectionTimeoutMS: 10000 });
  await client.connect();
  const authDb = client.db(config.AUTH_DATABASE);
  users = authDb.collection<User>("users");
  sessions = authDb.collection<AuthSession>("auth_sessions");
  await Promise.all([
    users.createIndex({ email: 1 }, { unique: true }),
    sessions.createIndex({ tokenHash: 1 }, { unique: true }),
    sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    sessions.createIndex({ userId: 1 })
  ]);
}
export async function closeAuthStore() { if (client) await client.close(); client = null; }
function getCollections() { if (!users || !sessions) throw new Error("Authentication storage is not initialized."); return { users, sessions }; }
function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
async function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${key.toString("hex")}`;
}
async function verifyPassword(password: string, stored: string) {
  const [scheme, salt, expectedHex] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = await scrypt(password, salt, expected.length) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export async function registerUser(emailInput: string, password: string) {
  const { users } = getCollections();
  const email = emailInput.trim().toLowerCase();
  const passwordDigest = await passwordHash(password);
  try {
    const result = await users.insertOne({ email, passwordHash: passwordDigest, createdAt: new Date() });
    return { id: result.insertedId.toHexString(), email };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) throw new Error("An account with this email already exists.");
    throw error;
  }
}
export async function loginUser(emailInput: string, password: string) {
  const { users } = getCollections();
  const email = emailInput.trim().toLowerCase();
  const user = await users.findOne({ email });
  // Perform a password hash even for unknown emails to reduce account-enumeration timing differences.
  const valid = user ? await verifyPassword(password, user.passwordHash) : await verifyPassword(password, "scrypt:00000000000000000000000000000000:" + "00".repeat(64));
  if (!user || !valid || !user._id) throw new Error("Invalid email or password.");
  return { id: user._id.toHexString(), email: user.email };
}
export async function createAuthSession(userId: string) {
  const { sessions } = getCollections();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + config.AUTH_SESSION_TTL_HOURS * 60 * 60 * 1000);
  await sessions.insertOne({ tokenHash: hashToken(token), userId: new ObjectId(userId), expiresAt, createdAt: new Date() });
  return { token, expiresAt };
}
export async function findAuthSession(token: string) {
  const { sessions, users } = getCollections();
  const session = await sessions.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } });
  if (!session) return null;
  const user = await users.findOne({ _id: session.userId }, { projection: { email: 1 } });
  if (!user?._id) { await sessions.deleteOne({ _id: session._id }); return null; }
  return { id: user._id.toHexString(), email: user.email };
}
export async function deleteAuthSession(token: string) {
  const { sessions } = getCollections();
  await sessions.deleteOne({ tokenHash: hashToken(token) });
}
export async function deleteUserSessions(userId: string) {
  const { sessions } = getCollections();
  await sessions.deleteMany({ userId: new ObjectId(userId) });
}
