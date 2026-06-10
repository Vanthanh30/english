# Learning API

Base path: `/api/v1/learning`

All endpoints require an access token:

```http
Authorization: Bearer <access-token>
```

Only active topics and published lessons are visible to learners.

## Catalog

- `GET /topics`
  - returns active topics with published lessons
  - includes lesson summaries and user-specific topic progress
- `GET /topics/:topicId/lessons`
  - returns published lessons for one active topic
- `GET /lessons/:lessonId`
  - returns ordered vocabulary cards with English and Vietnamese meanings
  - includes the example sentence and user-specific progress

## Progress

- `POST /lessons/:lessonId/vocabularies/:vocabularyId/complete`
  - marks one vocabulary item learned for the current user and lesson
  - repeated requests are idempotent
- `POST /lessons/:lessonId/complete`
  - completes a lesson after all its vocabulary has been learned
  - repeated requests preserve the original completion time

Progress is stored by `userId`, `lessonId`, and `vocabularyId`. A learner's
progress cannot change another learner's records.

The response progress shape is:

```json
{
  "completedVocabulary": 3,
  "totalVocabulary": 5,
  "percentage": 60,
  "completedAt": null
}
```
