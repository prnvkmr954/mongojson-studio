# MongoJSON Studio

A web-based JSON importer for MongoDB Atlas.

## Project status

Initial scaffold in progress. The application is being built with React + TypeScript + Vite on the frontend and Node.js + Express + TypeScript on the backend.

## Design decisions

- Connection strings are session-only and are never persisted.
- Users can select existing databases/collections or create new ones.
- Multi-document imports use ordered inserts. On a duplicate `_id`, the import stops and reports any documents already inserted; inserts are not automatically rolled back.
- JSON arrays, single JSON objects, and NDJSON will be supported.

## Prerequisites

- Node.js 20 or newer
- npm
- A MongoDB Atlas cluster and a database user with appropriate permissions

## Development

See the root `package.json` scripts and the client/server READMEs as they are added.

## Security

Never commit MongoDB connection strings, credentials, or `.env` files. Do not expose the importer to the public internet until authentication, outbound network restrictions, request limits, and session cleanup are configured.
