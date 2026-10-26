# MongoJSON Studio

A guided web app for importing JSON documents into MongoDB Atlas.

## Current milestone

This initial scaffold includes a responsive React/TypeScript dashboard and an Express API. The UI includes a session-only Atlas connection form and a connection-test action. Database and collection selection, JSON parsing, preview, and importing are next milestones.

## Stack

- Frontend: React, TypeScript, Vite, Lucide icons
- Backend: Node.js, Express, TypeScript, official MongoDB Node.js driver
- Validation: Zod

## Requirements

- Node.js 20+
- npm 10+
- MongoDB Atlas cluster and database user

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://127.0.0.1:5173. The API runs on http://127.0.0.1:4000.

The connection-test endpoint creates a temporary MongoClient and closes it after the ping. The connection string is not stored in browser storage, cookies or a database. An API route for a temporary in-memory session is included for the next database operations milestone.

## Decisions

- Do not persist Atlas connection strings.
- Existing and new databases/collections will be supported.
- Imports will use ordered inserts. A duplicate `_id` stops the import and reports any partial success; previously inserted documents are not rolled back automatically.
- Planned file formats: JSON array, single object and NDJSON.
- Planned initial upload limit: 10 MB.

## Security

Never commit real URIs or credentials. `.env` is gitignored. The API is bound to loopback for local development and avoids logging request bodies. Do not publicly deploy this version before adding authentication, rate limits, strict request limits, outbound-host restrictions/SSRF protection and hardened session handling.

## Commands

- `npm run dev` — frontend and API together
- `npm run build` — build both workspaces
- `npm run typecheck` — type-check client and server
