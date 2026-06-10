# Architecture

## System shape

English Quest starts as a modular monolith. This keeps deployment and local
development simple while preserving module boundaries that can be extracted
later if traffic or team ownership requires it.

```text
Browser
  |
  +-- Next.js web application
          |
          +-- NestJS REST API
                  |
                  +-- MongoDB (system of record)
                  +-- Redis (cache, queues, rate limits)
                  +-- External AI, storage, and email providers
```

## Backend boundaries

Each business module will use these layers:

- `domain`: entities, value objects, and repository contracts
- `application`: use cases and orchestration
- `infrastructure`: Prisma repositories and external provider adapters
- `presentation`: controllers, DTOs, guards, and serializers

Modules must communicate through public application contracts rather than
querying another module's tables directly.

The repository is rooted at `frontend/` and `backend/`. Backend classes are
grouped under `configs`, `controllers`, `helpers`, `middlewares`, `models`,
`repositories`, `routes`, and `services`.

## Frontend boundaries

- `app`: routes, layouts, and route-level loading/error states
- `features`: business workflows grouped by domain
- `components`: reusable presentation components
- `lib`: API client, query configuration, and utilities
- `stores`: small client-only Zustand stores

Route entries remain under `frontend/src/app` as required by Next.js App
Router. Interactive screen implementations are grouped by domain under
`frontend/src/components`. The requested `frontend/src/pages` tree is retained
as a tracked roadmap structure and must not contain `.tsx` route files while
the App Router owns routing.

Server Components remain the default. Client Components are limited to
interactive areas and provider boundaries.

## API conventions

- Base path: `/api/v1`
- JSON request and response bodies
- DTO validation with a global validation pipe
- JWT access tokens and rotating refresh tokens
- Role-based authorization enforced by guards
- OpenAPI documentation added with the first business endpoints

## Data conventions

- MongoDB ObjectId primary keys
- UTC timestamps
- Soft deletion only where recovery or audit requirements justify it
- Unique constraints enforce business invariants
- Prisma schema changes are applied with `prisma db push`
