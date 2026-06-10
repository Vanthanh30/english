# Sprint Backlog

## Definition of Done

Every sprint must include validation, authorization where applicable, unit
tests for business rules, integration tests for persistence boundaries,
updated API documentation, and a passing CI pipeline.

## Sprint 0 - Foundation

Deliver:

- npm workspace monorepo with Next.js and NestJS
- MongoDB, Redis, Prisma, environment validation, and Docker Compose
- health endpoint, global API validation, CORS, and security headers
- initial authentication schema
- lint, test, build, and CI workflow

Acceptance:

- a new developer can boot infrastructure and both apps from the README
- API and web production builds pass
- missing required environment variables fail fast

## Sprint 1 - Authentication and Authorization

Deliver:

- register, email verification, login, refresh, and logout endpoints
- bcrypt password hashing
- short-lived access JWT and rotating refresh token
- `STUDENT` and `ADMIN` guards/decorators
- login/register/verify pages and authenticated session handling

Acceptance:

- refresh token reuse is rejected
- unverified users cannot log in
- protected routes enforce role and authentication

## Sprint 2 - Admin Content Management

Deliver:

- topic, vocabulary, lesson, and lesson-item models
- admin CRUD APIs with pagination, search, validation, and publish workflow
- admin dashboard screens and forms

Acceptance:

- only admins can mutate content
- published lessons contain valid ordered vocabulary items

## Sprint 3 - Vocabulary Learning

Deliver:

- topic catalog, lesson view, vocabulary cards, and audio playback
- per-user lesson and vocabulary progress
- idempotent completion endpoints

Acceptance:

- progress is isolated by user
- completion percentages remain correct after repeated requests

## Sprint 4 - Notes

Deliver:

- owner-scoped note CRUD and full-text search
- sanitized rich-text editor

Acceptance:

- users cannot read or mutate another user's notes
- unsafe HTML is removed before storage/rendering

## Sprint 5 - Flashcards

Deliver:

- saved vocabulary and flashcard generation
- due-review queue and grading flow
- scheduling rules: hard 1 day, medium 2 days, easy 5 days

Acceptance:

- grading updates the next review date atomically
- only due cards appear in the default review queue

## Sprint 6 - Matching Game

Deliver:

- server-created game sessions, timed matching, score submission, leaderboard
- difficulty and topic selection

Acceptance:

- server validates elapsed time and score inputs
- duplicate result submissions are rejected

## Sprint 7 - AI Tutor

Deliver:

- streaming chat, conversation history, safety policy, and usage limits
- prompts grounded in learner level and recent context

Acceptance:

- secrets remain server-side
- unsafe requests are handled and provider failures degrade cleanly

## Sprint 8 - Image Vocabulary

Deliver:

- validated image upload to Cloudinary
- vision object detection, vocabulary suggestions, history, and save flow

Acceptance:

- file type and size limits are enforced
- users can edit AI suggestions before saving

## Sprint 9 - Study Schedule

Deliver:

- recurring schedules, timezone-aware reminders, email templates, and queue worker
- delivery log with idempotency key

Acceptance:

- each scheduled occurrence sends at most one reminder
- timezone and daylight-saving transitions are tested

## Sprint 10 - Dashboard and Analytics

Deliver:

- activity event model, aggregates, streaks, learning charts, and admin metrics
- near-real-time cache invalidation

Acceptance:

- dashboard totals reconcile with source events
- expensive aggregates do not block transactional requests

## Sprint 11 - Release

Deliver:

- at least 80% coverage on business modules
- integration, end-to-end, security, accessibility, and load testing
- production deployment, migrations, monitoring, backups, and runbooks

Acceptance:

- no critical defects
- rollback and restore procedures are exercised before release
