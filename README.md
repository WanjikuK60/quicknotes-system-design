# QuickNotes System Design

QuickNotes is a browser-based API client and a system design package for a
future online notes service intended to support one million users. The client
uses JSONPlaceholder as a practice API for loading, creating, and deleting
notes; the design documents describe the production API, relational data
model, and scalable service architecture.

**Live client:** https://wanjikuk60.github.io/quicknotes-system-design/

## Run the API client

1. Clone or download this repository.
2. Serve the project folder with any static web server (for example, run
   `python -m http.server 8000` from the project directory).
3. Open `http://localhost:8000` and choose **Load notes** or create a note.

The browser needs network access to JSONPlaceholder. Its POST and DELETE
responses are simulated: the service does not persist changes, so a created
note remains visible only until the page is reloaded.

## Design documents

- [API design](docs/api-design.md): REST endpoints, request and response examples, error format
- [Data model](docs/data-model.md): PostgreSQL schema, indexes, example queries, SQL vs NoSQL
- [Architecture](docs/architecture.md): requirements, capacity estimate for 1 million users, diagram, request flows, trade-offs

## Project structure

| Path | Purpose |
| --- | --- |
| `index.html` | API client page: create, load and delete notes |
| `api.js` | Request handling, rendering, and loading/success/error states |
| `style.css` | Layout and styles |
| `favicon.svg` | Browser tab icon |
| `docs/` | The three design documents |

## What I learned

- A browser client needs to model loading, success, empty, and failure states,
  not just the happy-path response.
- Reusable request handling and `textContent` make API calls and rendering
  safer and more maintainable.
- A normalized relational schema expresses ownership and many-to-many tag
  relationships while keeping them transactionally consistent.
- Read replicas, caches, and queues improve scale in different ways, but each
  introduces freshness, invalidation, retry, or operational trade-offs.
