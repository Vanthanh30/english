# Flashcard API

All endpoints require a Bearer access token and are scoped to the authenticated
user.

## List Flashcards

`GET /api/v1/flashcards`

Returns the user's complete flashcard collection.

## List Due Flashcards

`GET /api/v1/flashcards/due`

Returns flashcards whose `nextReviewAt` is due.

## Save Vocabulary

`POST /api/v1/flashcards/vocabulary/:vocabularyId`

Creates a flashcard from an existing vocabulary item.

## Review Flashcard

`POST /api/v1/flashcards/:id/review`

```json
{
  "difficulty": "easy"
}
```

Accepted values are `hard`, `medium`, and `easy`.

## Submit Writing Practice

`POST /api/v1/flashcards/:id/writing-practice`

```json
{
  "mode": "listening",
  "answer": "passport"
}
```

`mode` accepts `listening` or `meaning`. The answer check ignores letter case,
leading/trailing whitespace, and repeated spaces.

Example response:

```json
{
  "correct": true,
  "expectedAnswer": "passport",
  "mode": "listening",
  "difficulty": "easy",
  "flashcard": {}
}
```

A correct answer uses the Sprint 5 `easy` interval of 5 days. An incorrect or
empty answer uses the `hard` interval of 1 day.

## Make Flashcards Due

`POST /api/v1/flashcards/make-due`

```json
{
  "ids": ["507f1f77bcf86cd799439011"]
}
```

## Delete Flashcard

`DELETE /api/v1/flashcards/:id`
