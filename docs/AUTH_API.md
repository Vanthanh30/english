# Authentication API

Base path: `/api/v1/auth`

## Public endpoints

- `POST /register`: email, displayName, password
- `POST /verify-email`: token
- `POST /login`: email, password
- `POST /refresh`: rotates the HttpOnly refresh cookie
- `POST /logout`: revokes and clears the refresh cookie

Login and refresh return:

```json
{
  "accessToken": "short-lived-jwt",
  "user": {
    "id": "mongodb-object-id",
    "email": "learner@example.com",
    "displayName": "Learner",
    "avatarUrl": null,
    "role": "STUDENT",
    "emailVerifiedAt": "2026-06-06T00:00:00.000Z"
  }
}
```

## Protected endpoints

- `GET /me`: requires `Authorization: Bearer <access-token>`
- `GET /admin-check`: requires an access token with the `ADMIN` role

Refresh and verification tokens are stored as SHA-256 hashes. A refresh token
is revoked atomically before its replacement is stored, preventing reuse.
Authenticated sessions have a fixed maximum lifetime of 24 hours. Refresh
rotation preserves the original session expiry and cannot extend that window.
Tokens also contain a server-start session generation. Restarting the API
invalidates access and refresh tokens issued by the previous process, requiring
users to sign in again.

On the web client, the access token and public user profile are persisted in
the `english-quest-auth` local-storage entry. The refresh token remains in an
HttpOnly cookie and is never exposed to client JavaScript. On page reload, the
client validates the access token with `/me` and uses `/refresh` when needed.
If the API has restarted or the 24-hour session has expired, both checks fail
and the client clears the persisted session.
