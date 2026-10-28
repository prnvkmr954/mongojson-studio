import { Router } from "express";
import { z } from "zod";
import { clearAuthCookie, readAuthCookie, setAuthCookie, requireAuth } from "../middleware/auth.js";
import { createAuthSession, deleteAuthSession, loginUser, registerUser } from "../services/auth.service.js";
export const authRouter = Router();
const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(12, "Password must be at least 12 characters.").max(128).refine(value => !value.includes("\\u0000"), "Invalid password.")
});
authRouter.post("/register", async (request, response) => {
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
authRouter.post("/login", async (request, response) => {
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
  if (token) await deleteAuthSession(token).catch(() => undefined);
  clearAuthCookie(response);
  response.status(204).end();
});
