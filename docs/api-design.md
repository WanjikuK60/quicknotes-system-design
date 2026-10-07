# QuickNotes REST API design

The production API is versioned under `/v1` and uses JSON over HTTPS. Every
authenticated request includes a bearer access token. Notes and tags are scoped
to the authenticated user; clients cannot select another user's records by
passing a `userId`.

## Endpoints

| Method | Path | Description | Success status |
| --- | --- | --- | --- |
| `POST` | `/v1/users` | Register a user account. | `201 Created` |
| `GET` | `/v1/users/me` | Return the authenticated user's profile. | `200 OK` |
| `GET` | `/v1/notes` | List the user's notes; supports `limit`, `cursor`, and `tag`. | `200 OK` |
| `POST` | `/v1/notes` | Create a note for the authenticated user. | `201 Created` |
| `GET` | `/v1/notes/{noteId}` | Retrieve one note owned by the user. | `200 OK` |
| `PATCH` | `/v1/notes/{noteId}` | Update a note's title, body, or tags. | `200 OK` |
| `DELETE` | `/v1/notes/{noteId}` | Delete a note and its tag links. | `204 No Content` |
| `GET` | `/v1/tags` | List the authenticated user's tags. | `200 OK` |

List queries are ordered by `updatedAt DESC, id DESC` and return a
`nextCursor` when more results are available. The API caps `limit` at 100.

## Create a note

`POST /v1/notes`

Request:

```json
{
  "title": "Plan the launch",
  "body": "Review the release checklist with the team.",
  "tagIds": ["tag_01J8M4"]
}
```

Response (`201 Created`):

```json
{
  "id": "note_01J8N2",
  "title": "Plan the launch",
  "body": "Review the release checklist with the team.",
  "createdAt": "2026-10-07T12:00:00Z",
  "updatedAt": "2026-10-07T12:00:00Z",
  "tags": [
    {
      "id": "tag_01J8M4",
      "name": "work"
    }
  ]
}
```

The server validates a non-empty title (maximum 100 characters), validates
tag ownership, and derives the owner from the access token.

## List notes

`GET /v1/notes?limit=2&cursor=eyJ1cGRhdGVkQXQiOi...`

Response (`200 OK`):

```json
{
  "items": [
    {
      "id": "note_01J8N2",
      "title": "Plan the launch",
      "body": "Review the release checklist with the team.",
      "createdAt": "2026-10-07T12:00:00Z",
      "updatedAt": "2026-10-07T12:00:00Z",
      "tags": [{ "id": "tag_01J8M4", "name": "work" }]
    },
    {
      "id": "note_01J7X5",
      "title": "Reading list",
      "body": "Add two books to the list.",
      "createdAt": "2026-10-06T09:30:00Z",
      "updatedAt": "2026-10-06T09:30:00Z",
      "tags": []
    }
  ],
  "nextCursor": "eyJ1cGRhdGVkQXQiOiIyMDI2LTEwLTA2VDA5OjMwOjAwWiJ9"
}
```

## Errors

Errors use the HTTP status code and a consistent JSON envelope. The API may
return these statuses:

| Status | Meaning | Example situation |
| --- | --- | --- |
| `400 Bad Request` | Invalid JSON, parameters, or field validation. | Empty title or malformed cursor. |
| `401 Unauthorized` | Authentication is missing, invalid, or expired. | No valid bearer token. |
| `403 Forbidden` | The caller is authenticated but lacks permission. | Account is suspended or action is disallowed. |
| `404 Not Found` | The resource does not exist or is not visible to this user. | Unknown note ID. |
| `409 Conflict` | The request conflicts with current resource state. | Duplicate email registration. |
| `429 Too Many Requests` | The client exceeded a rate limit. | Too many requests in a short window. |
| `500 Internal Server Error` | Unexpected server-side failure. | Unhandled storage or service failure. |

Example (`400 Bad Request`):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid fields.",
    "details": [
      {
        "field": "title",
        "message": "Title is required and must be 100 characters or fewer."
      }
    ],
    "requestId": "req_01J8P0"
  }
}
```

The `requestId` is safe to share with support and correlates with server logs;
responses do not expose stack traces or internal database details.
