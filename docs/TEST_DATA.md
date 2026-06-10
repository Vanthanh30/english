# Sprint 1-3 Test Data

Run the idempotent seed after the MongoDB replica set is available:

```bash
npm run prisma:push
npm run seed
```

Running `npm run seed` again updates the same test records. It does not delete
unrelated users or content.

## Test Accounts

| Purpose | Email | Password | Initial state |
| --- | --- | --- | --- |
| Admin content management | `admin@englishquest.local` | `Admin123!` | Active admin |
| Student learning | `student@englishquest.local` | `Student123!` | Active with progress |
| Email verification | `pending@englishquest.local` | `Pending123!` | Pending verification |

The pending account verification token is:

```text
0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

Re-running the seed returns this account to pending status and creates a fresh
seven-day verification record.

## Seeded Content

- 3 topics
- 11 vocabulary records
- 3 published lessons
- 1 draft lesson for testing the admin publish workflow
- partial progress for `At the Airport`
- completed progress for `At a Restaurant`

Expected learner catalog progress:

- `Travel Essentials`: 29%
- `Food and Dining`: 100%
- `Workplace Communication` is hidden because its lesson is still a draft

## Test Routes

- Login: `http://localhost:3000/login`
- Admin content: `http://localhost:3000/admin/content`
- Learner catalog: `http://localhost:3000/courses`
- API health: `http://localhost:4000/api/v1/health`

These credentials are development-only and must not be reused in production.
