# QuickNotes data model

QuickNotes uses a relational model. A user owns many notes and many tags; a
note can have many tags, and a tag can label many notes. `note_tags` is the
join table that resolves the many-to-many relationship. All application
queries scope notes and tags to the authenticated `user_id`.

## Entities and keys

| Entity | Columns | Keys and relationships |
| --- | --- | --- |
| `users` | `id UUID`, `email VARCHAR(320)`, `password_hash TEXT`, `created_at TIMESTAMPTZ` | Primary key `id`; unique email. |
| `notes` | `id UUID`, `user_id UUID`, `title VARCHAR(100)`, `body TEXT`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ` | Primary key `id`; foreign key `user_id` references `users.id`. |
| `tags` | `id UUID`, `user_id UUID`, `name VARCHAR(50)`, `created_at TIMESTAMPTZ` | Primary key `id`; foreign key `user_id` references `users.id`; unique `(user_id, name)`. |
| `note_tags` | `note_id UUID`, `tag_id UUID`, `created_at TIMESTAMPTZ` | Composite primary key `(note_id, tag_id)`; foreign keys reference `notes.id` and `tags.id`. |

## PostgreSQL schema

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(320) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL CHECK (length(trim(title)) > 0),
    body TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL CHECK (length(trim(name)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, name)
);

CREATE TABLE note_tags (
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (note_id, tag_id)
);
```

An index on `(user_id, updated_at DESC, id DESC)` supports the common
user-scoped, newest-first notes listing and cursor pagination without sorting
every matching note:

```sql
CREATE INDEX notes_user_updated_idx
    ON notes (user_id, updated_at DESC, id DESC);
```

The composite primary key on `note_tags` also provides an index for finding
tags attached to a note. Add a reverse index for tag-to-note filtering:

```sql
CREATE INDEX note_tags_tag_note_idx ON note_tags (tag_id, note_id);
```

## Example queries

Create a note for an authenticated user:

```sql
INSERT INTO notes (user_id, title, body)
VALUES ($1, $2, $3)
RETURNING id, title, body, created_at, updated_at;
```

List a user's notes in stable newest-first order:

```sql
SELECT id, title, body, created_at, updated_at
FROM notes
WHERE user_id = $1
ORDER BY updated_at DESC, id DESC
LIMIT $2;
```

List notes with the user's tag names (JOIN):

```sql
SELECT n.id, n.title, n.body, t.id AS tag_id, t.name AS tag_name
FROM notes AS n
LEFT JOIN note_tags AS nt ON nt.note_id = n.id
LEFT JOIN tags AS t ON t.id = nt.tag_id AND t.user_id = n.user_id
WHERE n.user_id = $1
ORDER BY n.updated_at DESC, n.id DESC, t.name;
```

Update a note only when it belongs to the authenticated user:

```sql
UPDATE notes
SET title = $3, body = $4, updated_at = now()
WHERE id = $1 AND user_id = $2
RETURNING id, title, body, updated_at;
```

## SQL or NoSQL?

PostgreSQL is the best fit because notes, owners, tags, and note-tag links have
clear relationships and integrity constraints. Transactions can atomically
create a note and associate its tags, while indexes support owner-scoped
pagination. JSON fields can be added for genuinely flexible metadata without
giving up relational integrity. At one million users, a well-indexed relational
database is a simpler, safer starting point than operating a distributed
NoSQL store; partitioning or read replicas can be introduced as measured load
requires.
