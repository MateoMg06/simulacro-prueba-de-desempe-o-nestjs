# Commercial Requests API

A NestJS and TypeORM REST API for commercial follow-up requests. It uses PostgreSQL, API key protection, user and role guards, DTO validation, uniform responses, Swagger, request assignment, filters with pagination, an audit history and optimistic concurrency control.

## Repository

[GitHub repository](https://github.com/MateoMg06/simulacro-prueba-de-desempe-o-nestjs.git)

## Requirements

- Node.js 20 or newer
- npm
- PostgreSQL 15 or newer

## Setup

```bash
npm install
cp .env.example .env
```

Update the database credentials in `.env` and create the database named in `DB_DATABASE` (for example `CREATE DATABASE commercial_requests;`).

### Schema creation

With `DB_SYNCHRONIZE=true` TypeORM creates and updates the schema on startup (tables `users`, `clients`, `requests`, `request_history`, and the indexes on `requests.status`, `requests.advisorId`, `requests.createdAt` and `request_history.requestId`). This is meant for local evaluation; use migrations and set it to `false` before production use.

Sample data is added idempotently on startup: users `1` (admin), `2` (supervisor), `3` and `4` (advisors), the client `Acme Demo Client`, and one request assigned to advisor `3` in `IN_PROGRESS` (version 2) with its CREATION, ASSIGNMENT and STATUS events. These records are for local evaluation only.

Start the API:

```bash
npm run start:dev
```

The API listens on `http://localhost:3000` (or `PORT`); Swagger UI is available at `/docs`.

## Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

Compose exposes the API on port `3001` and PostgreSQL on port `5434` on the host.

## Authentication and permissions

Every endpoint requires `x-api-key` and `x-user`. `API_KEYS` accepts multiple comma-separated keys. The role always comes from the stored user, never from the request.

| Action | admin | supervisor | advisor |
| --- | --- | --- | --- |
| Create a request | ✅ (unassigned) | ✅ (unassigned) | ✅ (assigned to themselves) |
| List / view / history | all requests | all requests | only requests currently assigned to them |
| Change status | any request | any request | only their requests |
| Assign / reassign | ✅ | ✅ | ❌ 403 |

Allowed status changes are `PENDING` → `IN_PROGRESS` → `RESOLVED`.

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| POST | `/requests` | Create a request (`clientId`, `description`) and its CREATION event |
| GET | `/requests` | List visible requests with filters and pagination |
| GET | `/requests/:id` | Get one visible request |
| PATCH | `/requests/:id/status` | Change status (`status`, `expectedVersion`) |
| PATCH | `/requests/:id/assignment` | Assign or reassign an advisor (`advisorId`), admin/supervisor only |
| GET | `/requests/:id/history` | Read-only audit history of a visible request |
| POST | `/clients` | Create a client (admin or supervisor): `name`, `email`, `phone` required; `document` optional |
| GET | `/clients` | List clients |

### Query parameters of `GET /requests`

| Parameter | Description |
| --- | --- |
| `status` | `PENDING`, `IN_PROGRESS` or `RESOLVED` |
| `advisor` | Assigned advisor ID. For advisors it is combined with their own ID, so it can only narrow the result |
| `client` | Partial, case-insensitive client name (`ILIKE`) |
| `from`, `to` | ISO 8601 dates applied to `createdAt`; `from` later than `to` returns 400 |
| `page`, `limit` | Page starts at 1. Defaults `page=1`, `limit=10`; `limit` max 100. Zero, negatives and text return 400 |

Response:

```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": { "page": 1, "limit": 10, "total": 0, "totalPages": 0 }
  }
}
```

### Errors

Errors use `{ "success": false, "statusCode": ..., "message": ..., "timestamp": ..., "path": ... }`.

| Code | When |
| --- | --- |
| 400 | Invalid body/query, unknown properties, `null` values, blank text, invalid transition, `from > to`, assigning to a user that does not exist or is not an active advisor |
| 401 | Missing or invalid API key, or unknown `x-user` |
| 403 | Role not allowed (an advisor trying to assign) |
| 404 | Request/client not found, or a request the advisor is not assigned to |
| 409 | Outdated `expectedVersion`, or reassigning a `RESOLVED` request |
| 500 | Unexpected errors only |

## curl examples

```bash
KEY=local_demo_key_one
URL=http://localhost:3000

# Create as supervisor (stays unassigned)
curl -X POST $URL/requests -H "x-api-key: $KEY" -H "x-user: 2" \
  -H "Content-Type: application/json" \
  -d '{"clientId": 1, "description": "Coordinate a follow-up visit"}'

# Filter and paginate
curl "$URL/requests?status=IN_PROGRESS&client=acme&from=2026-10-01T00:00:00Z&to=2026-10-31T23:59:59Z&page=1&limit=10" \
  -H "x-api-key: $KEY" -H "x-user: 2"

# Assign to advisor 4
curl -X PATCH $URL/requests/1/assignment -H "x-api-key: $KEY" -H "x-user: 2" \
  -H "Content-Type: application/json" -d '{"advisorId": "4"}'

# Change status with the expected version (409 if it is outdated)
curl -X PATCH $URL/requests/1/status -H "x-api-key: $KEY" -H "x-user: 2" \
  -H "Content-Type: application/json" -d '{"status": "IN_PROGRESS", "expectedVersion": 1}'

# History
curl $URL/requests/1/history -H "x-api-key: $KEY" -H "x-user: 2"
```

## Technical decisions

- **Naming:** the API keeps the English contract from stage 1. Mapping to the specification: `/solicitudes` → `/requests`, `cliente` → `client`, `descripcion` → `description`, `asesor` → `advisor`, `estado` → `status`, `PENDIENTE/EN_GESTION/RESUELTA` → `PENDING/IN_PROGRESS/RESOLVED`, `creadaEn/actualizadaEn` → `createdAt/updatedAt`, `/asignacion` → `/assignment`, `/historial` → `/history`, `versionEsperada` → `expectedVersion`, `SolicitudHistorial` → `RequestHistory` (`tipoEvento/valorAnterior/valorNuevo/usuarioActor/fechaEvento` → `eventType/previousValue/newValue/actor/eventDate`), events `CREACION/ESTADO/ASIGNACION` → `CREATION/STATUS/ASSIGNMENT`.
- **Database:** PostgreSQL is kept from stage 1 instead of SQLite (a deliberate deviation from the specification). Client name search uses `ILIKE`.
- **Permissions in the query:** the advisor restriction is always part of the TypeORM query and filters are added with `AND`, so `advisor=other` returns an empty page for an advisor.
- **Inaccessible requests:** an advisor gets 404 for requests not assigned to them (detail, status and history), so the API does not reveal whether the ID exists.
- **Transactions:** every change and its history event are written with the same `EntityManager` inside `dataSource.transaction()`. If the event fails, the change is rolled back.
- **Concurrency:** status changes run `UPDATE ... WHERE id = :id AND version = :expectedVersion` and set `version + 1`. If no row is affected, another user changed it first and the API returns 409. Assignments also increase the version because the record changed.
- **Creation:** requests created by an advisor also store an initial ASSIGNMENT event. `advisorId` is no longer accepted on creation; admins and supervisors assign explicitly.
- **Text:** `description`, client `name`, `email`, `phone`, `document` and the `client` filter are trimmed and repeated spaces are collapsed; blank values are rejected.
- **Null values:** no field accepts an explicit `null`. Required fields reject it, and optional fields (`document`, list filters) use `@IsOptionalNotNull()`: they can be omitted, but `null` returns 400. In the database only three columns allow `NULL`, each with a meaning: `requests.advisorId` (unassigned request, required by the specification), `request_history.previousValue` (no previous value, e.g. CREATION) and `clients.document` (optional).

## Checks

```bash
npm run build
npm run lint
npm test -- --runInBand   # unit tests (no database needed)
npm run test:e2e          # needs PostgreSQL configured in .env
```

The unit tests cover API key validation, DTO validation (blank text, pagination limits), creation with and without assignment, filters composed with permissions, `from > to`, status transitions, version conflicts, history failure propagation, assignment rules and history access.

The e2e tests run against the PostgreSQL configured in `.env` (set `E2E_DB_DATABASE` to use a separate database) and cover the acceptance scenarios 01–12 of stage 2, including a real rollback when the history insert fails and two simultaneous status changes with the same version (one 200, one 409). They create their own client and requests with a unique name and delete them when they finish.
