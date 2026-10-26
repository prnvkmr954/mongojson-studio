# API server

Express + TypeScript API using the official MongoDB Node.js driver. `GET /api/health` is a liveness endpoint. `POST /api/connections/test` checks a URI with a temporary client and closes it. `POST /api/connections` opens an in-memory expiring connection session. `DELETE /api/connections/current` closes the session identified by `X-Session-Id`.

Public deployment is not ready: add authentication, outbound host restrictions/SSRF protection, rate limits, strict request limits, session protections and a security review before exposing this to the internet.
