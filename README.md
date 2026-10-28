# MongoJSON Studio

A guided web app for importing JSON and BSON backups into MongoDB Atlas, with account authentication.

## Current milestone

The app includes a React/TypeScript dashboard, session-only Atlas connection, database/collection selection, JSON preview and insertion, plus a backup uploader for multiple `.json` or `.bson` collection dump files.

## Stack

- Frontend: React, TypeScript, Vite, Lucide icons
- Backend: Node.js, Express, TypeScript, official MongoDB Node.js driver
- Validation: Zod

## Requirements

- Node.js 20+
- npm 10+
- MongoDB Atlas cluster and database user
- A separate persistent MongoDB database for application accounts (`AUTH_MONGODB_URI`)

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
- JSON imports support a single object or an array of objects. Backup import supports multiple plain `.json` or concatenated `.bson` collection dump files: collection mode inserts selected files into one destination collection; database mode maps each filename to a collection name. BSON values are deserialized using the BSON library.
- Backup upload limits default to 10 MB per file and 100 files per request, configurable with `MAX_UPLOAD_MB` (up to 100 MB). Database backup mode accepts collection `.json`/`.bson` files selected from a dump folder; it does not currently accept ZIP files or `mongodump --archive` files and does not restore indexes or collection options.

## Security

Never commit real URIs or credentials. `.env` is gitignored. The API is bound to loopback for local development and avoids logging request bodies. This is an authentication foundation, not yet ready for public launch. Before public deployment, add email verification, password reset/recovery, abuse controls (including registration throttling and bot protection), stronger upload and request limits, outbound-host restrictions/SSRF protection for user-supplied MongoDB URIs, security headers/CSP, monitoring, and a security review. Connection sessions are currently in-memory, so use sticky routing or move them to a properly designed shared session service before running multiple API instances. Deploy only behind HTTPS; `Secure` cookies are enabled when `NODE_ENV=production`.

## Commands

- `npm run dev` — frontend and API together
- `npm run build` — build both workspaces
- `npm run typecheck` — type-check client and server
