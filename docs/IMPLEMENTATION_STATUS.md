# Implementation Status

## Sprint 0 - Complete

- npm workspace monorepo created
- Next.js web application and NestJS API scaffolded
- MongoDB replica-set and Redis Docker Compose configuration added
- Prisma 6.19 configured for MongoDB and the authentication schema
- environment validation, CORS, Helmet, API prefix, and health endpoint added
- React Query and Zustand dependencies installed
- CI workflow, architecture document, and sprint backlog added
- lint, unit test, end-to-end health test, build, and dependency audit pass

## Sprint 1 - Complete

- registration with bcrypt password hashing
- email verification with expiring, hashed verification tokens
- SMTP delivery with a development console fallback
- login with short-lived access JWT
- rotating refresh JWT stored in an HttpOnly cookie
- logout and server-side refresh-token revocation
- fixed 24-hour sessions invalidated when the API process restarts
- Bearer authentication guard and role-based authorization guard
- login, registration, verification, and authenticated dashboard pages
- application tests for registration, verification state, token hashing, and
  refresh rotation

MongoDB schema application is intentionally deferred. Run `npm run prisma:push`
against the configured database when it is ready.

## Sprint 2 - Complete

- MongoDB models for topics, vocabulary, lessons, and ordered lesson items
- admin-only CRUD APIs with validation, pagination, search, and filtering
- topic ownership rules and duplicate vocabulary prevention
- lesson draft and publish workflow with topic consistency validation
- Cloudinary image upload with type and 5 MB size limits
- admin dashboard for topic, vocabulary, and lesson management
- create, update, delete, image upload, lesson word selection, and publishing
- application tests for content invariants

The updated MongoDB schema has not been pushed. Run `npm run prisma:push` when
the configured database is ready.

## Sprint 3 - Complete

- authenticated topic catalog containing active topics and published lessons
- mobile-friendly vocabulary lesson screen with ordered word navigation
- uploaded vocabulary audio playback with browser speech fallback
- per-user, per-lesson vocabulary progress
- explicit lesson completion after every vocabulary item is learned
- save-to-notes action on every vocabulary card
- idempotent vocabulary and lesson completion endpoints
- topic and lesson completion percentages derived from persisted progress
- tests for user isolation, repeat requests, percentage accuracy, and lesson
  completion rules

The Sprint 3 progress collections have not been pushed automatically. Run
`npm run prisma:push` against the configured MongoDB database before using the
learning screens.

## Sprint 4 - Complete

- owner-scoped note create, read, update, and delete APIs
- paginated personal note search across title and sanitized content
- server-side rich-text allowlist sanitization before persistence
- responsive personal notebook with formatting toolbar and note search
- protected notes route linked from the authenticated dashboard
- idempotent vocabulary-to-note creation linked from Sprint 3 lessons
- tests for unsafe HTML removal, ownership isolation, and pagination

## Structure Refactor

- applications moved from `apps/web` and `apps/api` to `frontend` and `backend`
- frontend reorganized into assets, components, pages, routes, services,
  stores, hooks, utilities, types, and App Router entries
- backend reorganized into configs, controllers, helpers, middlewares, models,
  repositories, routes, and services
- NestJS retained instead of rewriting the working API to Express

## Sprint 5 - Complete

- saved vocabulary flashcard collection
- due-review queue and manual card review
- hard, medium, and easy scheduling rules
- bulk study and collection filtering

## Sprint 6 - Complete

- topic and custom-flashcard matching games
- classic memory-grid and sequential speed modes
- difficulty-based timers, scoring, and topic leaderboards
- flashcard writing practice at `/flashcards/practice`
- searchable flashcard selection for custom writing-practice sessions
- listening prompts using uploaded audio or browser speech synthesis
- Vietnamese/English meaning prompts
- server-side spelling checks with case and whitespace normalization
- correct answers scheduled as easy; incorrect and skipped answers as hard
- session accuracy, missed-word summary, and dashboard navigation

## Next

Sprint 7 implements the AI English tutor and conversation history.
