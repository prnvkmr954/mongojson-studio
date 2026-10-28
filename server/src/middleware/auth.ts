import type { NextFunction, Request, Response } from "express";
import { findAuthSession } from "../services/auth.service.js";
import { config } from "../config.js";
declare global {
  namespace Express {
    interface Request { authUser?: { id: string; email: string } }
  }
}
export const AUTH_COOKIE = "mongojson_session";
export function readAuthCookie(request: Request) {
  const raw = request.headers.cookie ?? "";
  for (const part of raw.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === AUTH_COOKIE) return decodeURIComponent(value.join("="));
  }
  return undefined;
}
export function setAuthCookie(response: Response, token: string, expiresAt: Date) {
  const secure = config.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader("Set-Cookie", `${AUTH_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}${secure}`);
}
export function clearAuthCookie(response: Response) {
  const secure = config.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader("Set-Cookie", `${AUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}
export async function requireAuth(request: Request, response: Response, next: NextFunction) {
  try {
    const token = readAuthCookie(request);
    if (!token || token.length > 200) { response.status(401).json({ message: "Please sign in to continue." }); return; }
    const user = await findAuthSession(token);
    if (!user) { clearAuthCookie(response); response.status(401).json({ message: "Your session expired. Please sign in again." }); return; }
    request.authUser = user;
    next();
  } catch { response.status(503).json({ message: "Authentication service is temporarily unavailable." }); }
}
export function requireSameOrigin(request: Request, response: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) { next(); return; }
  const origin = request.get("origin");
  let originHost = ""; try { originHost = origin ? new URL(origin).host : ""; } catch { originHost = ""; }
  if (!originHost || originHost !== request.get("host")) { response.status(403).json({ message: "Request origin could not be verified." }); return; }
  next();
}
