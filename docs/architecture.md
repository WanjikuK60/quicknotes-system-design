# QuickNotes service architecture

## Requirements

### Functional

- Register and authenticate users and scope every note and tag to its owner.
- Create, read, update, and delete notes; list notes with pagination and tag filtering.
- Create and manage tags and associate multiple tags with each note.
- Validate requests, return consistent errors, and expose health and readiness checks.
- Send asynchronous email and audit work through a durable queue.

### Non-functional

- Target 99.9% monthly availability for note reads and writes.
- Keep typical API latency below 200 ms at the 95th percentile, excluding email work.
- Encrypt traffic in transit and sensitive stored credentials at rest; apply least privilege.
- Scale application capacity horizontally and recover from a single instance or zone failure.
- Back up the database and test recovery; define and monitor explicit RPO and RTO objectives.
- Emit structured logs, metrics, traces, and request IDs without logging note contents.

## Capacity estimate for 1 million users

This first-pass estimate assumes 1,000,000 monthly users, 10% active daily
(100,000 DAU), 20 note reads and 2 note writes per active user per day, and an
average stored note of 2 KiB including row/index overhead.

| Measure | Estimate and calculation |
| --- | --- |
| Reads per second (daily average) | `100,000 × 20 / 86,400 ≈ 23` reads/s; plan for a 10× peak of about 230 reads/s. |
| Writes per second (daily average) | `100,000 × 2 / 86,400 ≈ 2.3` writes/s; plan for a 10× peak of about 23 writes/s. |
| Storage per year | At 2 notes/user/day and 2 KiB/note: `1,000,000 × 2 × 365 × 2 KiB ≈ 1.36 TiB/year` of raw note data. Replicas, indexes, backups, and growth require additional capacity. |

These are planning assumptions, not measured traffic; production telemetry
should revise them and account for actual retention, request mix, and note size.

## Architecture diagram

```text
                         +-------------------+
                         |   DNS / managed   |
                         |   health checks   |
                         +---------+---------+
                                   |
Browser / mobile client ----------+
          |                        v
          +----------------> +----------+
                             | CDN/WAF  |
                             +----+-----+
                                  |
                             +----v------+
                             | Load      |
                             | balancer  |
                             +--+-----+--+
                                |     |
                         +------v+   +v-------+
                         | App 1 |   | App 2  |   ... more replicas
                         +--+----+   +---+----+
                            |            |
             +--------------+------------+-----------------+
             |                           |                 |
        +----v-----+                +----v------+     +----v------+
        | Cache    |                | Primary DB|     | Queue     |
        | (HA)     |                +----+------+     | (durable) |
        +----------+                     |            +----+------+
                                    +----v------+          |
                                    | Read      |      +---v------+
                                    | replica   |      | Worker   |
                                    +-----------+      +----------+
```

## Component responsibilities

- **Client:** Provides the user interface and sends authenticated HTTPS requests without owning server-side authorization.
- **DNS:** Resolves the service name and directs clients to the healthy regional entry point.
- **CDN/WAF:** Caches static assets near users and filters common malicious or abusive traffic before it reaches the API.
- **Load balancer:** Terminates/routs incoming API traffic across healthy app instances and removes failed instances from rotation.
- **App servers (at least two):** Run stateless API logic, validate inputs, authorize ownership, and scale out independently.
- **Cache:** Reduces repeated hot reads and database load; cache keys include user scope, and writes invalidate or update affected entries.
- **Primary database:** Commits authoritative note and tag changes with relational integrity and transaction guarantees.
- **Read replica:** Serves eligible read traffic and isolates some reporting/list load from the write primary.
- **Queue:** Durably buffers retryable asynchronous tasks so temporary worker outages do not lose work or block API responses.
- **Worker:** Processes queued email, audit, and other non-critical jobs with bounded retries and dead-letter handling.

## Request flows

### `GET /v1/notes`

1. The client resolves the API hostname through DNS and establishes HTTPS to the CDN/WAF.
2. The CDN forwards the uncached API request to the load balancer, which selects a healthy app server.
3. The app server validates the access token, derives the user ID, and validates pagination/filter parameters.
4. The app checks the user-scoped cache; on a miss it queries the read replica using the owner and sort indexes.
5. The app maps rows into the response envelope, caches eligible results briefly, and returns `200 OK`.
6. The client renders returned fields as text; no note content is treated as HTML.

### `POST /v1/notes`

1. The client sends JSON over HTTPS; DNS, CDN/WAF, and the load balancer route it to a healthy app server.
2. The app authenticates the request, derives the owner from the token, and validates title and tag IDs.
3. The app begins a database transaction, inserts the note into the primary, and associates validated tags.
4. The transaction commits; the app invalidates relevant user-scoped list cache entries.
5. The app publishes asynchronous side effects to the durable queue (for example, an audit event); a transactional outbox can ensure committed changes are not lost before publication.
6. The app returns `201 Created` with the note representation; workers process queued jobs independently.

## Trade-offs and failure handling

| Trade-off | Decision and rationale |
| --- | --- |
| Read replica freshness vs. read scale | Replicas reduce primary read pressure but can lag. Use the primary for read-after-write requests where freshness is required; tolerate slight lag for ordinary listings. |
| Cache speed vs. consistency | Cache short-lived list results to reduce database load, but invalidate on writes and keep TTLs bounded. A cache miss or outage falls back to the database, so cache is not the system of record. |
| Synchronous simplicity vs. queued work | Keep note persistence synchronous for clear success/failure semantics; move email and audit work to a queue so slow integrations do not lengthen note requests. Queue consumers must be idempotent. |

No single app server is a single point of failure: at least two stateless
instances run behind health-checked load balancing in separate failure zones.
The managed DNS/CDN/load-balancer control plane is multi-zone; the database
uses automated failover to a replica with tested backups; cache and queue use
replicated managed configurations, and the worker pool has multiple consumers.
Alerting, runbooks, and recovery tests cover provider or regional failures that
cannot be eliminated by replication alone.
