# Fleet Tracking Dashboard — Take-Home Task

## Overview

We run a GPS fleet tracking platform. For this task, you'll build a minimal but production-minded version of our core stack: a backend that ingests GPS pings from vehicles and a frontend that visualizes them on a live map.

We provide a **simulator** that mimics real GPS devices — it sends HTTP pings to your backend on an interval. You build the backend that receives and serves this data, and the frontend that displays it.

Estimated time: **6-10 hours**. We're not looking for a polished product — we're looking for sound architecture, clean code, and good judgment about trade-offs under time constraints.

## What we provide

A `simulator/` setup that:

- Drives a **fixed fleet of 10 vehicles** (`vehicle_id` 1–10) — the fleet size is not configurable
- Posts to your `POST /api/pings` roughly once per second. Batch size and vehicle composition vary from request to request (anywhere from 1 to 10 ping objects) — don't assume a fixed batch size or a fixed interval between pings for any given vehicle
- `occurred_at` on every ping reflects the real time it was sent, so data always looks "live"
- Reads `BACKEND_URL` from `simulator/.env`

Each request body is an array of ping objects:

```json
[
  {
    "vehicle_id": "integer",
    "lat": "float",
    "long": "float",
    "speed": "float (km/h)",
    "ignition": "0 | 1",
    "occurred_at": "ISO 8601"
  }
]
```

## What you build

```
fleet-task/
├── frontend/
├── backend/
├── simulator/          # already provided, do not modify
└── docker-compose.yml  # you complete this (simulator section is already given)
```

### Backend (TypeScript + Fastify)

How you store and query ping data is entirely up to you. Postgres alone is a perfectly fine answer — so is Postgres plus Redis for hot/latest state, or ClickHouse (or another store altogether) for the historical trace queries. We're not grading "did you use Postgres correctly" — we're grading whether your storage choice is a deliberate, justified fit for the access patterns this API needs: frequent small writes, a "latest known state per vehicle" read, and ranged historical reads with aggregation. Explain your reasoning in the README.

If your design includes a relational store, query builder is your choice (Kysely, Knex, raw `pg`, etc.) — please avoid a full ORM (e.g. Prisma, TypeORM), we'd like to see your query-building skills directly.

Each vehicle (`id` 1–10, matching the simulator's `vehicle_id`) has a `plate_number` and a `model_name`. Model that metadata however fits your architecture, and decide how vehicle records get created (pre-seeded, upserted on first ping, etc.) — pick whichever you can justify.

Endpoints:

**`POST /api/pings`**
Receives and persists a batch of GPS pings from the simulator (an array of ping objects per request — batch size varies, see above). Validate each item in the batch; reject malformed input with an appropriate error response.

On success, respond with `{ "ok": true }`. The simulator treats any error status, or a response that doesn't match this body, as a failed delivery — it will retry the exact same batch once before giving up and dropping it. Keep that in mind if you're not deduplicating: a batch you've already persisted may arrive a second time.

**`GET /api/vehicles`**
Returns every known vehicle along with its latest known state: location, speed, ignition status, and `occurred_at`. A vehicle that hasn't sent a ping yet should still appear in the response, with those fields `null` rather than causing an error.

**`GET /api/vehicles/:id/pings?from=<ISO8601>&to=<ISO8601>`**
Returns the vehicle's trace and stats for the given time window:

```json
{
  "vehicle_id": "integer",
  "trace": [
    { "lat": "float", "lng": "float", "speed": "float", "ignition": "0 | 1", "occurred_at": "ISO 8601" }
  ],
  "ignition_cycles": "integer",
  "max_speed": "float",
  "avg_speed": "float"
}
```

`ignition_cycles` = number of `0 → 1` transitions in the ignition signal within the requested window (i.e., how many times the vehicle was turned on).

Validate `from`/`to` (format, presence, and logical ordering) and return proper HTTP status codes and error bodies throughout.

### Frontend (React + TypeScript)

Bundler/framework of your choice (Vite, Next.js, etc.). Map library of your choice (Google Maps, Yandex Maps, etc.).

A single main view:

- All active vehicles shown as markers on a map
- Markers auto-refresh every 10 seconds
- Clicking a vehicle marker reveals `from`/`to` time pickers; selecting a range draws that vehicle's movement trace (polyline) on the map
- A trace panel showing `ignition_cycles`, `max_speed`, and `avg_speed` for the selected range
- Loading and error states throughout

### Docker Compose

`docker compose up -d` must bring up all three services — `frontend`, `backend`, `simulator` — with no manual steps afterward. Each service reads configuration from its own `.env` file (`simulator/.env`, `backend/.env`, `frontend/.env`). Wire up `depends_on` correctly so services start in the right order.

The `simulator` service definition is already complete below — copy it into your `docker-compose.yml` as-is and add your `backend` and `frontend` service definitions around it.

```yaml
services:
  simulator:
  build: ./simulator
    env_file:
      - ./simulator/.env
    depends_on:
      backend:
        condition: service_healthy
    restart: unless-stopped
```

> Note: this assumes your `backend` service exposes a healthcheck (so `condition: service_healthy` resolves). If you don't add one, adjust this to `condition: service_started` instead, but a healthcheck is recommended.

## README.md

Your submission must include a `README.md` at the project root answering:

1. **Setup** — step-by-step instructions to run the project from a clean checkout.
2. **Storage architecture** — which datastore(s) did you use to ingest and query ping data, and why? How does your choice support both the "latest state per vehicle" read and the historical trace/range query?
3. **`ignition_cycles` computation** — did you calculate this in the database query or in the application layer? Why did you choose that approach?
4. **Scaling** — if the system had to ingest 1M+ pings per day, what would you change in the architecture?

## Submission

Push your work to a Git repository (we look at your commit history, not just the final diff) and send us the link.

Reach out if anything in this brief is ambiguous — we'd rather you ask than guess.

Good luck!
