# Notes API

Base path: `/api/v1/notes`

Every endpoint requires `Authorization: Bearer <access-token>`. Notes are always
scoped to the authenticated user. A note owned by another user is returned as
not found.

## Endpoints

- `GET /?page=1&limit=20&search=travel`: list and search personal notes
- `GET /:id`: get one personal note
- `POST /`: create a note
- `PATCH /:id`: update a note
- `DELETE /:id`: delete a note
- `GET /vocabulary`: list saved vocabulary cards separately
- `GET /vocabulary/:vocabularyId`: check whether a word is saved
- `POST /vocabulary/:vocabularyId`: create an editable study note from a word

Create and update body:

```json
{
  "title": "Travel phrases",
  "contentHtml": "<h2>Airport</h2><p>Where is the departure gate?</p>"
}
```

The API sanitizes rich text before storage. Supported formatting includes
paragraphs, headings, emphasis, lists, blockquotes, code, and safe links.
Scripts, event handlers, unsafe URL schemes, and unsupported elements are
removed. Search matches the title and plain text extracted from the sanitized
content.

Saving vocabulary is idempotent per user and word. The generated note includes
pronunciation, part of speech, Vietnamese meaning, English definition, example
sentence, topic, and a section for personal notes. Repeated saves return the
existing note.
