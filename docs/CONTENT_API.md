# Admin Content API

All endpoints require:

```http
Authorization: Bearer <admin-access-token>
```

Users without the `ADMIN` role receive `403 Forbidden`.

## Topics

- `GET /api/v1/admin/content/topics`
- `GET /api/v1/admin/content/topics/:id`
- `POST /api/v1/admin/content/topics`
- `PATCH /api/v1/admin/content/topics/:id`
- `DELETE /api/v1/admin/content/topics/:id`

Topics support level, ordering, active status, and a Cloudinary image URL/public
ID. A topic cannot be deleted while it owns vocabulary or lessons.

List query parameters:

- `page`, `limit`, `search`
- `level`: `BEGINNER`, `INTERMEDIATE`, or `ADVANCED`
- `isActive`: `true` or `false`

## Vocabulary

- `GET /api/v1/admin/content/vocabularies`
- `GET /api/v1/admin/content/vocabularies/:id`
- `POST /api/v1/admin/content/vocabularies`
- `PATCH /api/v1/admin/content/vocabularies/:id`
- `DELETE /api/v1/admin/content/vocabularies/:id`

Words are unique within a topic. A word cannot be deleted while it belongs to a
lesson.

Create requests require both `meaning` (English definition) and `meaningVi`
(Vietnamese meaning). Update requests may change either field independently.

List query parameters: `page`, `limit`, `search`, and `topicId`.

## Lessons

- `GET /api/v1/admin/content/lessons`
- `GET /api/v1/admin/content/lessons/:id`
- `POST /api/v1/admin/content/lessons`
- `PATCH /api/v1/admin/content/lessons/:id`
- `POST /api/v1/admin/content/lessons/:id/publish`
- `DELETE /api/v1/admin/content/lessons/:id`

Lessons start as drafts. Publishing requires at least one vocabulary item, and
every item must belong to the lesson topic.

List query parameters: `page`, `limit`, `search`, `topicId`, and `status`
(`DRAFT` or `PUBLISHED`).

## Image Upload

`POST /api/v1/admin/uploads/image`

- multipart field: `file`
- formats: JPEG, PNG, WebP
- maximum size: 5 MB
- destination: `english-quest/content` in Cloudinary

The response contains the secure URL and Cloudinary public ID. Store both on
the topic or vocabulary record.
