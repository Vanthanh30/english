# English Quest

English Quest is a gamified English learning platform built as an npm
workspace monorepo.

## Applications

- `frontend`: Next.js client and admin portal
- `backend`: NestJS REST API
- `docs`: architecture decisions and sprint backlog

## Prerequisites

- Node.js 24+
- npm 11+
- Docker Desktop

## Local setup

```bash
copy .env.example .env
npm install
```

Generate the Prisma client and start both applications:

```bash
npm run prisma:generate
npm run dev
```

`JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` must each contain at least 32
characters. Without SMTP configuration, development registrations print the
verification URL in the API console. Production requires `SMTP_HOST`.
Authenticated sessions expire after 24 hours and are invalidated whenever the
API process restarts, so users must sign in again after a backend restart.

Content images are uploaded to Cloudinary. Keep real Cloudinary credentials in
`.env`; `.env.example` must contain placeholders only.

When database-backed features are needed, start the local MongoDB replica set
and push the Prisma schema:

```bash
npm run infra:up
npm run prisma:push
```

The web app runs at `http://localhost:3000`. The API health endpoint is
`http://localhost:4000/api/v1/health`.

MongoDB is not required for linting, unit tests, the current end-to-end health
test, or production builds. For MongoDB Atlas, set `DATABASE_URL` to the Atlas
connection string and run `npm run prisma:push` once per schema update.

## Quality commands

```bash
npm run lint
npm test
npm run test:e2e
npm run build
```

See [docs/SPRINT_BACKLOG.md](docs/SPRINT_BACKLOG.md) for the delivery plan.
API contracts are documented in [docs/AUTH_API.md](docs/AUTH_API.md) and
[docs/CONTENT_API.md](docs/CONTENT_API.md). Learner vocabulary and progress
endpoints are documented in [docs/LEARNING_API.md](docs/LEARNING_API.md).
Personal note endpoints are documented in
[docs/NOTES_API.md](docs/NOTES_API.md).

Development accounts and Sprint 1-4 sample content can be created with:

```bash
npm run seed
```

See [docs/TEST_DATA.md](docs/TEST_DATA.md) for credentials and expected data.

## Project structure

```text
english-quest/
|-- frontend/   Next.js application
|-- backend/    NestJS API
|-- docs/
|-- docker-compose.yml
`-- README.md
```

The requested backend layer names are used while retaining NestJS dependency
injection and modules. `backend/src/routes/*.routes.ts` are Nest modules, not
Express routers.
