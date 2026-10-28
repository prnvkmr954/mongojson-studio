# API server

Express + TypeScript API using the official MongoDB Node.js driver. The server requires `AUTH_MONGODB_URI` pointing to a dedicated persistent application database. It stores account records and hashed authentication session tokens there; never point it at a database URI supplied by an end user.

Authentication endpoints:
- `POST /api/auth/register` — create an account (password minimum 12 characters)
- `POST /api/auth/login` — sign in
- `GET /api/auth/me` — current account
- `POST /api/auth/logout` — revoke sessions and clear the cookie

Passwords are scrypt-hashed with random salts. Browser sessions use opaque random tokens, only token hashes are stored, and the cookie is HttpOnly and SameSite=Lax (Secure in production). Login and registration have rate limits. Connection, destination, JSON import and backup import routes require authentication. Atlas sessions are tied to the authenticated account.

Local setup: copy `.env.example` to `.env` (on Windows CMD: `copy .env.example .env`) and set `AUTH_MONGODB_URI` to a dedicated database before starting the API.

Public launch blockers: email verification and password recovery are not yet implemented; user-provided MongoDB URIs need outbound-host/SSRF protections; uploads and general API requests need more stringent production limits and security review. Atlas connection sessions remain in-memory and require a shared session design before horizontally scaling.
