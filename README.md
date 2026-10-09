# Commercial Requests API

A small NestJS and TypeORM REST API for creating commercial follow-up requests. It uses PostgreSQL, API key protection, user and role guards, DTO validation, uniform responses, and Swagger.

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

Update the database credentials in `.env`. Sample data for every entity is added idempotently on startup. The sample users are IDs `1` (admin), `2` (supervisor), `3` and `4` (advisors); the sample client is `Acme Demo Client`; and advisor `3` has a sample request in `IN_PROGRESS` with a matching status history entry. These records are for local evaluation only.

Start the API:

```bash
npm run start:dev
```

The API listens on `http://localhost:3000`; Swagger UI is available at `/docs`.

## Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

Compose exposes the API on port `3001` and PostgreSQL on port `5434` on the host.

## Authentication and permissions

Every endpoint requires `x-api-key` and `x-user`. `API_KEYS` accepts multiple comma-separated keys. Admins and supervisors can list and view all requests. Advisors can access only requests assigned to them. Advisors are assigned to their own requests; admins and supervisors can choose an advisor with `advisorId` or omit it to select the first active advisor. New requests always start as `PENDING`.

Allowed status changes are `PENDING` → `IN_PROGRESS` → `RESOLVED`. Each successful change is saved to `status_history`.

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| POST | `/requests` | Create a request (`clientId`, `description`) |
| GET | `/requests` | List requests visible to the current user |
| GET | `/requests/:id` | Get one visible request |
| PATCH | `/requests/:id/status` | Change status (`status`) |
| POST | `/clients` | Create a client (admin or supervisor) |
| GET | `/clients` | List clients |

Example create body:

```json
{
  "clientId": 1,
  "description": "Follow up about the annual service proposal."
}
```

Example status body:

```json
{
  "status": "IN_PROGRESS"
}
```

Example client body:

```json
{
  "name": "Acme Ltd",
  "email": "contact@acme.example",
  "phone": "+1-555-0100",
  "document": "TAX-12345"
}
```

Successful responses use `{ "success": true, "data": ... }`. Errors use `{ "success": false, "statusCode": ..., "message": ..., "timestamp": ..., "path": ... }`.

## Configuration

See `.env.example`. `DB_SYNCHRONIZE=true` is convenient for local evaluation; use migrations and set it to `false` before production use.

## Remove the old table

The old `public.solicitudes` table is not used by this API. The current table is `public.requests`. To remove the old table, open `database/cleanup-legacy-table.sql` in pgAdmin's Query Tool and run it. The script removes the legacy table only when it is empty; if it contains data, it stops and leaves the table untouched.

## Checks

```bash
npm test -- --runInBand
npm run build
```

The unit tests cover API key validation, request creation, client validation, ownership filtering, and status transitions. The e2e test requires PostgreSQL to be running and checks that protected routes reject a missing API key.
