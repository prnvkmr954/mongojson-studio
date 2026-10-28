import { Router } from "express";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { config } from "../config.js";
import { clearAuthCookie, readAuthCookie, setAuthCookie, requireAuth } from "../middleware/auth.js";
import { createAuthSession, deleteAuthSession, deleteUserSessions, findAuthSession, findOrCreateGoogleUser, loginUser, registerUser } from "../services/auth.service.js";
import { disconnectUserSessions } from "../services/session.service.js";
export const authRouter = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false, message: { message: "Too many authentication attempts. Please try again later." } });

const googleOAuth = config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET
  ? new OAuth2Client(config.GOOGLE_CLIENT_ID, config.GOOGLE_CLIENT_SECRET, config.GOOGLE_REDIRECT_URI || `http://localhost:${config.PORT}/api/auth/google/callback`)
  : null;
const GOOGLE_STATE_COOKIE = "mongojson_google_state";
function setGoogleStateCookie(response: import("express").Response, state: string) {
  const secure = config.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader("Set-Cookie", `${GOOGLE_STATE_COOKIE}=${state}; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=600${secure}`);
}
function clearGoogleStateCookie(response: import("express").Response) {
  const secure = config.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader("Set-Cookie", `${GOOGLE_STATE_COOKIE}=; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}
function readGoogleStateCookie(request: import("express").Request) {
  return (request.headers.cookie ?? "").split(";").map(part => part.trim()).find(part => part.startsWith(GOOGLE_STATE_COOKIE + "="))?.slice(GOOGLE_STATE_COOKIE.length + 1);
}
function stateMatches(a: string, b: string) {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
authRouter.get("/google", (request, response) => {
  if (!googleOAuth || !config.GOOGLE_CLIENT_ID) { response.redirect(302, `${config.CLIENT_ORIGIN}/?authError=google_not_configured`); return; }
  const state = randomBytes(32).toString("base64url");
  setGoogleStateCookie(response, state);
  response.redirect(googleOAuth.generateAuthUrl({ access_type: "online", scope: ["openid", "email", "profile"], state, prompt: "select_account" }));
});
authRouter.get("/google/callback", async (request, response) => {
  const fail = (reason: string) => { clearGoogleStateCookie(response); response.redirect(302, `${config.CLIENT_ORIGIN}/?authError=${encodeURIComponent(reason)}`); };
  if (!googleOAuth || !config.GOOGLE_CLIENT_ID) { fail("google_not_configured"); return; }
  const state = typeof request.query.state === "string" ? request.query.state : "";
  const cookieState = readGoogleStateCookie(request);
  const code = typeof request.query.code === "string" ? request.query.code : "";
  if (!state || !cookieState || !stateMatches(state, cookieState) || !code) { fail("google_state"); return; }
  try {
    const { tokens } = await googleOAuth.getToken(code);
    if (!tokens.id_token) { fail("google_token"); return; }
    const ticket = await googleOAuth.verifyIdToken({ idToken: tokens.id_token, audience: config.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || payload.email_verified !== true) { fail("google_email"); return; }
    const user = await findOrCreateGoogleUser(payload.sub, payload.email);
    const session = await createAuthSession(user.id);
    clearGoogleStateCookie(response);
    setAuthCookie(response, session.token, session.expiresAt);
    response.redirect(302, config.CLIENT_ORIGIN);
  } catch {
    fail("google_failed");
  }
});
\nconst credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(12, "Password must be at least 12 characters.").max(128)
});
authRouter.post("/register", authLimiter, async (request, response) => {
  const parsed = credentialsSchema.safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ message: parsed.error.issues[0]?.message ?? "Enter a valid email and password." }); return; }
  try {
    const user = await registerUser(parsed.data.email, parsed.data.password);
    const session = await createAuthSession(user.id);
    setAuthCookie(response, session.token, session.expiresAt);
    response.status(201).json({ user });
  } catch (error) {
    if (error instanceof Error && /already exists/.test(error.message)) { response.status(409).json({ message: error.message }); return; }
    response.status(503).json({ message: "Could not create your account. Check server authentication configuration." });
  }
});
authRouter.post("/login", authLimiter, async (request, response) => {
  const parsed = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(128) }).safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ message: "Enter a valid email and password." }); return; }
  try {
    const user = await loginUser(parsed.data.email, parsed.data.password);
    const session = await createAuthSession(user.id);
    setAuthCookie(response, session.token, session.expiresAt);
    response.json({ user });
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid email or password.") { response.status(401).json({ message: error.message }); return; }
    response.status(503).json({ message: "Sign-in is temporarily unavailable." });
  }
});
authRouter.get("/me", requireAuth, (request, response) => response.json({ user: request.authUser }));
authRouter.post("/logout", async (request, response) => {
  const token = readAuthCookie(request);
  if (token) { const user = await findAuthSession(token).catch(() => null); if (user) { await deleteUserSessions(user.id).catch(() => undefined); disconnectUserSessions(user.id); } await deleteAuthSession(token).catch(() => undefined); }
  clearAuthCookie(response);
  response.status(204).end();
});
