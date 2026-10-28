import "dotenv/config";
import { z } from "zod";
const envSchema = z.object({ PORT: z.coerce.number().int().min(1).max(65535).default(4000), CLIENT_ORIGIN: z.string().url().default("http://localhost:5173"), SESSION_TTL_MINUTES: z.coerce.number().int().min(5).max(240).default(30), MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(100).default(10), AUTH_MONGODB_URI: z.string().min(1).optional(), AUTH_DATABASE: z.string().min(1).default("mongojson_studio_auth"), AUTH_SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(24), NODE_ENV: z.enum(["development","test","production"]).default("development") });
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) throw new Error(`Invalid server configuration: ${parsed.error.issues.map(issue => issue.path.join(".")).join(", ")}`);
export const config = parsed.data;
