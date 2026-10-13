# AGENTS.md — Guía del proyecto

## 1. Propósito

Este repositorio implementa una API REST para gestionar solicitudes de seguimiento comercial de asesores a clientes. Es una prueba técnica en dos etapas; la segunda amplía la primera y **debe evolucionar sobre el código existente**, conservando lo que ya funcione y evitando reescrituras innecesarias.

Usa este archivo como guía para cualquier agente que inspeccione, modifique, pruebe o documente el proyecto. Las dos especificaciones entregadas para la prueba son la referencia funcional principal. Si el código actual difiere de ellas, identifica la diferencia explícitamente y resuélvela con cambios pequeños y coherentes; no describas un requisito como cumplido hasta comprobarlo.

## 2. Objetivos funcionales

### Etapa 1

- Registrar solicitudes comerciales.
- Consultar listados y detalles respetando los permisos del usuario.
- Cambiar estados con transiciones válidas.
- Proteger todos los endpoints funcionales con `x-api-key` y una identidad válida en `x-user`.
- Validar cuerpos y parámetros con DTO y `ValidationPipe`.
- Estandarizar respuestas exitosas con un interceptor y errores con un `ExceptionFilter`.
- Documentar la API con Swagger/OpenAPI.
- Mantener usuarios de prueba y roles en memoria o en el catálogo de usuarios de prueba, sin implementar inicio de sesión ni JWT.

### Etapa 2

- Asignar y reasignar solicitudes a asesores existentes.
- Añadir filtros y paginación en base de datos.
- Persistir historial de creación, cambios de estado y asignaciones.
- Usar transacciones para que una modificación y su historial se confirmen o reviertan juntos.
- Controlar concurrencia en cambios de estado con versión esperada y HTTP 409 ante versiones obsoletas.
- Añadir pruebas automatizadas para reglas críticas.

## 3. Reglas de negocio obligatorias

### Solicitudes y estados

- Una solicitud nueva comienza siempre en estado pendiente, sin aceptar que el cliente fuerce un estado inicial.
- En la especificación funcional, los estados son `PENDIENTE`, `EN_GESTION` y `RESUELTA`. El orden de transición permitido es `PENDIENTE → EN_GESTION → RESUELTA`.
- No permitir saltar directamente de `PENDIENTE` a `RESUELTA` ni reabrir una solicitud resuelta.
- `cliente` y `descripcion` son obligatorios; rechazar cadenas vacías o compuestas solo por espacios y normalizar los espacios de texto.
- El identificador, las fechas de auditoría, la versión y demás campos administrados por el sistema no deben poder modificarse desde DTO de entrada.

### Identidad, roles y permisos

- Los roles de la especificación son `admin`, `supervisor` y `asesor`.
- `x-user` identifica a un usuario de prueba existente. No confiar en un rol que venga enviado libremente por el cliente.
- `x-api-key` es obligatorio en todos los endpoints funcionales. Las claves se cargan de `API_KEYS`, separadas por comas, desde variables de entorno; nunca hardcodear secretos.
- Cualquier usuario válido puede registrar una solicitud.
- Si la crea un asesor, queda asignada a ese mismo asesor. Si la crea un supervisor o administrador, debe quedar sin asignación hasta que se asigne explícitamente.
- Admin y supervisor pueden consultar todas las solicitudes. Un asesor solo puede consultar las que estén asignadas a su propio usuario.
- Admin y supervisor pueden cambiar el estado de cualquier solicitud. Un asesor solo puede cambiar el estado de una solicitud asignada a él.
- Solo admin y supervisor pueden asignar o reasignar solicitudes.
- El asesor asignado debe existir y tener rol asesor. No asignar a usuarios inexistentes, inactivos si el dominio los considera no elegibles, administradores ni supervisores.
- Una solicitud `RESUELTA` no se puede reasignar; responder con HTTP 409.
- Reasignar no cambia automáticamente el estado.
- Las consultas individuales y de historial deben verificar autorización, no solo el listado.
- Las restricciones de permisos deben formar parte de la consulta TypeORM. Los filtros no pueden ampliar el alcance permitido a un asesor.

### Filtros y paginación

`GET /solicitudes` debe admitir, cuando se complete la etapa 2:

- `estado`: uno de los estados permitidos.
- `asesor`: identificador del asesor asignado.
- `cliente`: búsqueda parcial sin distinguir mayúsculas/minúsculas cuando lo permita el motor.
- `desde` y `hasta`: fechas ISO 8601 aplicadas a la fecha de creación.
- `page` y `limit`: página basada en 1; valores predeterminados `page=1`, `limit=10`; `limit` máximo 100.
- Rechazar cero, negativos, texto inválido, fechas inválidas y `desde > hasta` con HTTP 400.
- Devolver colección y metadatos `page`, `limit`, `total`, `totalPages`.
- Aplicar paginación y filtros en la consulta a la base de datos, junto con las restricciones de rol.

### Historial y concurrencia

- Cada creación produce evento `CREACION`; cada transición de estado produce `ESTADO`; cada asignación o reasignación produce `ASIGNACION`.
- Cada evento debe registrar la solicitud, tipo, valor anterior cuando aplique, valor nuevo, actor y fecha/hora.
- El historial es de solo lectura para consumidores: no añadir endpoints para editar o borrar eventos.
- Admin y supervisor pueden consultar el historial de cualquier solicitud; un asesor solo el de solicitudes que tiene asignadas actualmente.
- La escritura de solicitud y evento de historial debe ocurrir dentro de la misma transacción.
- Los cambios de estado deben recibir `versionEsperada` (o un mecanismo equivalente documentado), compararla con la versión persistida y aumentar la versión al guardar.
- Si la versión no coincide, devolver HTTP 409 y no modificar ni estado ni historial.

## 4. Contrato HTTP y errores

La especificación funcional define estos endpoints mínimos:

- `POST /solicitudes`
- `GET /solicitudes`
- `GET /solicitudes/:id`
- `PATCH /solicitudes/:id/estado`
- `PATCH /solicitudes/:id/asignacion`
- `GET /solicitudes/:id/historial`

Todos deben exigir `x-api-key` y `x-user`.

La respuesta exitosa debe mantener un formato uniforme, por ejemplo `{ "success": true, "data": ... }`. El listado paginado debe incluir `items` y `pagination` dentro de `data`.

El filtro de excepciones debe preservar códigos HTTP y devolver un formato uniforme con, como mínimo, `success: false`, `statusCode`, `message`, `timestamp` y `path`. Usa códigos coherentes:

- `400 Bad Request`: DTO, parámetros, filtros o transición inválidos según el contrato que se documente.
- `401 Unauthorized`: falta o invalidez de API key o identidad.
- `403 Forbidden`: usuario autenticado sin permiso.
- `404 Not Found`: recurso inexistente o inaccesible si esa es la política elegida y documentada.
- `409 Conflict`: conflicto de negocio o versión obsoleta.
- `500 Internal Server Error`: solo errores inesperados; no convertir indiscriminadamente errores de validación o negocio en 500.

Documentar encabezados, parámetros, DTO, ejemplos y respuestas relevantes en Swagger. La interfaz Swagger se sirve actualmente en `/docs`.

## 5. Arquitectura actual del repositorio

- `src/main.ts`: arranque, `ValidationPipe` global, interceptor, filtro de excepciones y Swagger.
- `src/app.module.ts`: configuración global y conexión TypeORM.
- `src/auth/`: guard de API key, guard de identidad, guard de roles y decoradores `@CurrentUser()` y `@Roles()`.
- `src/requests/`: controlador, servicio, DTO, entidad de solicitud, enum de estado e historial de estado.
- `src/clients/`: módulo de clientes, controlador, servicio, DTO y entidad.
- `src/users/`: entidad de usuario y datos de demostración.
- `src/common/interceptors/response.interceptor.ts`: envoltorio uniforme de respuestas exitosas.
- `src/common/filters/api-exception.filter.ts`: normalización de errores.
- `test/`: pruebas e2e; los archivos `*.spec.ts` junto al código contienen pruebas unitarias.
- `.env.example`: plantilla de configuración local.
- `Dockerfile` y `docker-compose.yml`: ejecución contenerizada.

Mantén la separación entre controladores (HTTP), servicios (reglas de negocio), entidades/persistencia, DTO y componentes transversales. Evita concentrar reglas de negocio en controladores.

## 6. Diferencias conocidas entre el código actual y la especificación

Antes de ampliar funcionalidades, revisa estas diferencias. Son observaciones del repositorio entregado, no requisitos alternativos:

1. **Base de datos:** el código y `.env.example` usan PostgreSQL (`type: 'postgres'`), mientras que la especificación exige SQLite. No cambies el motor silenciosamente: decide la migración de forma explícita y actualiza configuración, dependencias, Docker y README de forma consistente.
2. **Rutas y nomenclatura:** el código expone `/requests` y `/clients`, con propiedades en inglés (`clientId`, `description`, `advisorId`, `status`) y estados `PENDING`, `IN_PROGRESS`, `RESOLVED`. La especificación pide `/solicitudes`, campos en español y estados `PENDIENTE`, `EN_GESTION`, `RESUELTA`. Alinea contrato, código y Swagger deliberadamente; si se conserva compatibilidad con rutas actuales, documenta ambas.
3. **Asignación:** el servicio actual asigna a un asesor por defecto cuando crea admin/supervisor una solicitud, y la entidad requiere asesor no nulo. La etapa 2 exige que estas solicitudes queden sin asignación hasta una asignación explícita.
4. **Historial:** existe `StatusHistory`, pero representa solo cambios de estado. No cubre el esquema genérico de auditoría ni eventos de creación/asignación exigidos por la etapa 2.
5. **Transacciones:** el servicio actual guarda el cambio de estado y el historial en operaciones separadas. Deben ejecutarse en una transacción.
6. **Concurrencia:** la entidad no tiene versión y el DTO actual de estado no recibe `versionEsperada`.
7. **Listado:** el listado actual no incluye filtros ni paginación.
8. **Asignación e historial HTTP:** todavía no aparecen los endpoints de asignación ni consulta de historial.
9. **Roles:** el código usa `advisor` donde la especificación usa `asesor`. Evita mezclar valores sin una conversión o migración consistente.
10. **Validación de texto:** los DTO actuales deben reforzarse para rechazar cadenas de solo espacios y normalizar texto.
11. **Pruebas:** ampliar las pruebas para cubrir las reglas nuevas, incluyendo rollback transaccional y concurrencia.

## 7. Entorno y comandos

Revisa `package.json` y el README antes de cambiar scripts o dependencias. Los comandos definidos actualmente incluyen:

```bash
npm install
cp .env.example .env
npm run start:dev
npm run build
npm test -- --runInBand
npm run test:e2e
npm run lint
npm run format
```

La configuración y el README actuales describen PostgreSQL; esto debe reconciliarse con el requisito SQLite si se decide completar la especificación literalmente. No asumir que las pruebas e2e funcionarán sin la base de datos configurada.

`API_KEYS` acepta varias claves separadas por comas. Los valores del `.env.example` son exclusivamente ficticios para desarrollo local.

## 8. Guía de implementación para agentes

1. Lee los módulos y pruebas relevantes antes de editar.
2. Identifica qué requisito satisface cada cambio y añade o ajusta pruebas.
3. Usa DTO independientes para creación, filtros, asignación y cambio de estado/versionado.
4. Mantén `ValidationPipe` con `whitelist: true`, `forbidNonWhitelisted: true` y `transform: true`; no aceptes propiedades protegidas por accidente.
5. Aplica guards y permisos a todos los endpoints funcionales, incluidos los nuevos.
6. En consultas TypeORM, combina restricciones de propiedad, filtros y paginación antes de recuperar filas.
7. Para cambios con auditoría, usa transacciones TypeORM y el mismo `EntityManager` transaccional para todas las escrituras relacionadas.
8. Para concurrencia, realiza una comprobación atómica o bloqueo/actualización condicional de versión; una lectura seguida de un `save` sin protección no basta.
9. Mantén el historial inmutable desde la API pública.
10. Actualiza Swagger, README, `.env.example` y pruebas al modificar rutas, DTO, configuración o contratos.
11. No añadas JWT, frontend ni integraciones externas: están fuera del alcance de la prueba.
12. No añadas secretos reales, datos personales reales ni claves válidas a código o documentación.
13. No afirmes que build, tests o endpoints funcionan si no se ejecutaron y verificaron.
14. Prefiere cambios acotados y justificados. No borres ni reemplaces funcionalidades existentes sin comprobar sus usos y pruebas.

## 9. Criterios mínimos de aceptación

Antes de dar por terminada una tarea relevante, comprueba según aplique:

- API key ausente/inválida rechazada; dos claves configuradas distintas aceptadas.
- Identidad desconocida rechazada y rol obtenido del usuario validado.
- DTO inválidos y propiedades desconocidas rechazados.
- Solicitudes persistidas en TypeORM.
- Asesores limitados a sus solicitudes en listados, detalles y consultas de historial.
- Solo admin/supervisor pueden asignar y reasignar.
- Asignaciones a usuarios no elegibles rechazadas; solicitudes resueltas no reasignables.
- Transiciones de estado inválidas rechazadas.
- Filtros y paginación aplicados en la base de datos, con límites correctos.
- Cada creación, cambio de estado y asignación genera el evento adecuado.
- Error al escribir historial provoca rollback de la modificación asociada.
- Versión desactualizada devuelve 409 sin aplicar cambios.
- Respuestas exitosas y errores siguen los contratos documentados.
- Swagger, README, configuración y pruebas reflejan el comportamiento actual.
- Ve agregando todo lo que vayas haciendo al archivo memory.md

