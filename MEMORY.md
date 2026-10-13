# Bitácora del proyecto

## 2026-10-13 — Parte 2 de la prueba

### Decisiones tomadas con el usuario
- Se mantiene **PostgreSQL** (la especificación pide SQLite; desviación consciente, documentada en README).
- Se mantiene el **contrato en inglés** de la Parte 1 (`/requests`, `status`, `advisor`, `PENDING/IN_PROGRESS/RESOLVED`). La equivalencia con los nombres en español está en el README ("Technical decisions").

### Cambios realizados
- **Historial:** `StatusHistory` se reemplazó por `RequestHistory` (tabla `request_history`; `eventType` CREATION/STATUS/ASSIGNMENT, `previousValue`, `newValue`, `actor`, `eventDate`). Endpoint de solo lectura `GET /requests/:id/history`.
- **Solicitud:** `advisor` pasa a ser opcional, hay un campo nuevo `version` y se añadieron índices en `status`, `advisor` y `createdAt`.
- **Creación:** un asesor queda asignado a sí mismo (eventos CREATION + ASSIGNMENT); un admin o supervisor deja la solicitud sin asignar (solo evento CREATION). `advisorId` ya no se acepta en la creación.
- **Asignación:** `PATCH /requests/:id/assignment`, solo admin y supervisor. El destino debe ser un asesor activo (si no, 400) y una solicitud RESOLVED responde 409. No cambia el estado, sí sube la versión.
- **Listado:** `ListRequestsQueryDto` con `status`, `advisor`, `client`, `from`, `to`, `page` y `limit` (por defecto 1/10, máximo 100), aplicados en un QueryBuilder junto con la restricción del asesor. Respuesta `{ items, pagination }`.
- **Concurrencia:** `UpdateStatusDto.expectedVersion`. Un `UPDATE` condicional por versión dentro de la transacción devuelve 409 si la versión cambió.
- **Transacciones:** toda escritura se hace con `dataSource.transaction()` y el mismo `EntityManager` se usa para el historial.
- **Texto:** decorador `@NormalizeText()` (`src/common/transforms/normalize-text.ts`) en description, el nombre del cliente y el filtro `client`.
- **Filtro de errores:** `message` ahora es el texto (o la lista de mensajes de validación), sin el objeto anidado de Nest.
- **`src/app.setup.ts`:** `configureApp()` lo comparten `main.ts` y el e2e.
- **`app.module.ts`:** `driver: pg` explícito, porque TypeORM no podía cargar `pg` bajo Jest ESM. Se añadió `@types/pg` como devDependency.
- **Pruebas:** 31 unitarias (servicio y DTO) y 25 e2e contra PostgreSQL (escenarios 01–12, rollback real y carrera concurrente). `test/jest-e2e.json` usa `testTimeout` de 30 s.
- Se creó la base local `seguimiento_comercial` (la configurada en `.env`), que no existía.

### Corrección de tipos en las pruebas
- `api-key.guard.spec.ts`: el `beforeEach` usa llaves para no devolver el objeto `jest` (TS2322).
- `test/app.e2e-spec.ts`: `import type { App } from 'supertest/types.js'`, porque `moduleResolution: nodenext` exige la extensión (TS2307).
- `npx tsc --noEmit` ahora termina sin errores.

### Valores null (decisiones del usuario)
- **Entrada:** ningún campo acepta `null` explícito. Nuevo decorador `@IsOptionalNotNull()` (`src/common/validators/is-optional-not-null.ts`), que valida siempre salvo cuando el campo no se envía. Se usa en `document` y en los filtros del listado.
- **Clientes:** `email` y `phone` pasan a ser obligatorios en el DTO y NOT NULL en la entidad. A los 5 clientes `E2E Client …` de la base local se les rellenó `email = e2e-<id>@example.test` y `phone = +1-555-0000` (no se borró nada).
- **Se mantienen en null a propósito:**
  - `requests.advisorId`: solicitud sin asignar (RN-07, escenario 12).
  - `request_history.previousValue`: no hay valor anterior (RN-09, "cuando corresponda").
  - `clients.document`: campo opcional.
- **e2e:** al terminar borra el cliente y las solicitudes que creó (el historial se borra por CASCADE), así no se acumulan datos de prueba.
- **Pruebas:** 40 unitarias y 26 e2e en verde; `tsc --noEmit` sin errores.

### Tabla antigua `status_history`
- Se revisaron todas las bases del PostgreSQL local (`seguimiento_comercial`, `postgres`, `exam_db`, `tourism_db`) y no existe la tabla `status_history` en ninguna, así que no hubo nada que borrar. Tampoco existe en la base de Docker Compose (contenedor `commercial-requests-db`, volumen `simulacro-prueba-de-desempe-o-nestjs_postgres_data`), que solo tiene `clients`, `request_history`, `requests` y `users`.
- Se quitó del README la sección "Legacy tables".
