# QuickNotes System Design

QuickNotes is a browser-based API client and a system design package for a
future online notes service intended to support one million users. The client
uses JSONPlaceholder as a practice API for loading, creating, and deleting
notes; the design documents describe the production API, relational data
model, and scalable service architecture.

## Run the API client

1. Clone or download this repository.
2. Serve the project folder with any static web server (for example, run
   `python -m http.server 8000` from the project directory).
3. Open `http://localhost:8000` and choose **Load notes** or create a note.

The browser needs network access to JSONPlaceholder. Its POST and DELETE
responses are simulated: the service does not persist changes, so a created
note remains visible only until the page is reloaded.

## Design documents

- [API design](docs/api-design.md)
- [Data model](docs/data-model.md)
- [Architecture](docs/architecture.md)

## What I learned

- A browser client needs to model loading, success, empty, and failure states,
  not just the happy-path response.
- Reusable request handling and `textContent` make API calls and rendering
  safer and more maintainable.
- A normalized relational schema expresses ownership and many-to-many tag
  relationships while keeping them transactionally consistent.
- Read replicas, caches, and queues improve scale in different ways, but each
  introduces freshness, invalidation, retry, or operational trade-offs.
