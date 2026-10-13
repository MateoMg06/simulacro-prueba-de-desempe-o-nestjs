import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource, EntityManager } from 'typeorm';

// Real environment variables take precedence over .env in ConfigModule.
// Two fictional keys are set here to check that both are accepted.
process.env.API_KEYS = 'e2e_key_one,e2e_key_two';
if (process.env.E2E_DB_DATABASE) {
  process.env.DB_DATABASE = process.env.E2E_DB_DATABASE;
}

const { AppModule } = await import('../src/app.module.js');
const { configureApp } = await import('../src/app.setup.js');
const { RequestHistory } =
  await import('../src/requests/dao/request-history.entity.js');

const ADMIN = '1';
const SUPERVISOR = '2';
const ADVISOR_ONE = '3';
const ADVISOR_TWO = '4';

describe('Requests API (e2e)', () => {
  let app: INestApplication<App>;
  let clientId: number;
  // Unique client name so list assertions only see rows created by this run.
  const clientName = `E2E Client ${Date.now()}`;

  const api = (user: string, key = 'e2e_key_one') => {
    const server = app.getHttpServer();
    const withHeaders = (test: request.Test) =>
      test.set('x-api-key', key).set('x-user', user);
    return {
      get: (url: string) => withHeaders(request(server).get(url)),
      post: (url: string, body: object) =>
        withHeaders(request(server).post(url)).send(body),
      patch: (url: string, body: object) =>
        withHeaders(request(server).patch(url)).send(body),
    };
  };

  const createRequest = async (user: string, description = 'E2E follow-up') => {
    const res = await api(user)
      .post('/requests', { clientId, description })
      .expect(201);
    return res.body.data;
  };

  const historyTypes = async (id: number) => {
    const res = await api(ADMIN).get(`/requests/${id}/history`).expect(200);
    return res.body.data.map((event: any) => event.eventType);
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    const res = await api(ADMIN)
      .post('/clients', {
        name: clientName,
        email: 'e2e@example.test',
        phone: '+1-555-0000',
        document: `E2E-${Date.now()}`,
      })
      .expect(201);
    clientId = res.body.data.id;
  });

  // Removes the client and requests created by this run (history is deleted by CASCADE).
  afterAll(async () => {
    if (clientId) {
      const dataSource = app.get(DataSource);
      await dataSource.query('DELETE FROM requests WHERE "clientId" = $1', [
        clientId,
      ]);
      await dataSource.query('DELETE FROM clients WHERE id = $1', [clientId]);
    }
    await app?.close();
  });

  describe('protection and validation', () => {
    it('rejects a missing API key with 401', () =>
      request(app.getHttpServer())
        .get('/requests')
        .set('x-user', ADMIN)
        .expect(401)
        .expect(({ body }) =>
          expect(body).toMatchObject({
            success: false,
            statusCode: 401,
            path: '/requests',
          }),
        ));

    it('rejects an invalid API key with 401', () =>
      api(ADMIN, 'wrong_key').get('/requests').expect(401));

    it('accepts both configured API keys', async () => {
      await api(ADMIN, 'e2e_key_one').get('/requests').expect(200);
      await api(ADMIN, 'e2e_key_two').get('/requests').expect(200);
    });

    it('rejects an unknown user with 401', () =>
      api('unknown').get('/requests').expect(401));

    it('rejects blank descriptions and protected properties with 400', async () => {
      await api(ADVISOR_ONE)
        .post('/requests', { clientId, description: '   ' })
        .expect(400);
      await api(ADVISOR_ONE)
        .post('/requests', { clientId, description: 'Ok', status: 'RESOLVED' })
        .expect(400);
      await api(SUPERVISOR)
        .post('/requests', { clientId, description: 'Ok', advisorId: '3' })
        .expect(400);
    });

    it('rejects null values in bodies with 400', async () => {
      await api(ADVISOR_ONE)
        .post('/requests', { clientId, description: null })
        .expect(400);
      await api(ADVISOR_ONE)
        .post('/requests', { clientId: null, description: 'Ok' })
        .expect(400);
      const validClient = {
        name: 'Null Check Client',
        email: 'null-check@example.test',
        phone: '+1-555-0001',
      };
      for (const field of ['name', 'email', 'phone', 'document']) {
        await api(ADMIN)
          .post('/clients', { ...validClient, [field]: null })
          .expect(400);
      }
      await api(ADMIN)
        .post('/clients', { name: 'No Contact Client' })
        .expect(400);
      await api(SUPERVISOR)
        .patch('/requests/1/assignment', { advisorId: null })
        .expect(400);
      await api(SUPERVISOR)
        .patch('/requests/1/status', { status: null, expectedVersion: null })
        .expect(400);
    });
  });

  describe('creation', () => {
    it('Scenario 12: a supervisor creates an unassigned PENDING request with a CREATION event', async () => {
      const created = await createRequest(SUPERVISOR, '  Visit   the client ');
      expect(created).toMatchObject({
        status: 'PENDING',
        advisor: null,
        version: 1,
        description: 'Visit the client',
      });
      expect(await historyTypes(created.id)).toEqual(['CREATION']);
    });

    it('an advisor creates a request assigned to themselves', async () => {
      const created = await createRequest(ADVISOR_ONE);
      expect(created.advisor.id).toBe(ADVISOR_ONE);
      expect(await historyTypes(created.id)).toEqual([
        'CREATION',
        'ASSIGNMENT',
      ]);
    });
  });

  describe('assignment', () => {
    it('Scenario 01: a supervisor assigns a request and an ASSIGNMENT event is stored', async () => {
      const created = await createRequest(SUPERVISOR);
      const res = await api(SUPERVISOR)
        .patch(`/requests/${created.id}/assignment`, { advisorId: ADVISOR_TWO })
        .expect(200);
      expect(res.body.data).toMatchObject({
        status: 'PENDING',
        advisor: { id: ADVISOR_TWO },
      });
      const history = await api(ADMIN)
        .get(`/requests/${created.id}/history`)
        .expect(200);
      expect(history.body.data[1]).toMatchObject({
        eventType: 'ASSIGNMENT',
        previousValue: null,
        newValue: ADVISOR_TWO,
        actor: { id: SUPERVISOR },
      });
    });

    it('Scenario 02: assigning to a non-advisor or unknown user is rejected without changes', async () => {
      const created = await createRequest(SUPERVISOR);
      for (const advisorId of [SUPERVISOR, ADMIN, 'does-not-exist']) {
        await api(SUPERVISOR)
          .patch(`/requests/${created.id}/assignment`, { advisorId })
          .expect(400);
      }
      const res = await api(ADMIN).get(`/requests/${created.id}`).expect(200);
      expect(res.body.data).toMatchObject({ advisor: null, version: 1 });
      expect(await historyTypes(created.id)).toEqual(['CREATION']);
    });

    it('Scenario 03: an advisor cannot reassign (403)', async () => {
      const created = await createRequest(ADVISOR_ONE);
      await api(ADVISOR_ONE)
        .patch(`/requests/${created.id}/assignment`, { advisorId: ADVISOR_TWO })
        .expect(403);
    });

    it('Scenario 04: a RESOLVED request cannot be reassigned (409)', async () => {
      const created = await createRequest(ADVISOR_ONE);
      await api(ADVISOR_ONE)
        .patch(`/requests/${created.id}/status`, {
          status: 'IN_PROGRESS',
          expectedVersion: 1,
        })
        .expect(200);
      await api(ADVISOR_ONE)
        .patch(`/requests/${created.id}/status`, {
          status: 'RESOLVED',
          expectedVersion: 2,
        })
        .expect(200);
      await api(SUPERVISOR)
        .patch(`/requests/${created.id}/assignment`, { advisorId: ADVISOR_TWO })
        .expect(409);
    });
  });

  describe('list with filters and pagination', () => {
    it('Scenario 05: an advisor filter cannot widen an advisor scope', async () => {
      await createRequest(ADVISOR_ONE);
      await createRequest(ADVISOR_TWO);
      const encodedClient = encodeURIComponent(clientName);
      const own = await api(ADVISOR_ONE)
        .get(`/requests?client=${encodedClient}&limit=100`)
        .expect(200);
      expect(own.body.data.items.length).toBeGreaterThan(0);
      for (const item of own.body.data.items) {
        expect(item.advisor.id).toBe(ADVISOR_ONE);
      }
      const other = await api(ADVISOR_ONE)
        .get(`/requests?client=${encodedClient}&advisor=${ADVISOR_TWO}`)
        .expect(200);
      expect(other.body.data.items).toEqual([]);
    });

    it('returns items and pagination metadata', async () => {
      const res = await api(SUPERVISOR)
        .get(
          `/requests?client=${encodeURIComponent(clientName.toUpperCase())}&page=1&limit=2`,
        )
        .expect(200);
      const { items, pagination } = res.body.data;
      expect(items).toHaveLength(2);
      expect(pagination.page).toBe(1);
      expect(pagination.limit).toBe(2);
      expect(pagination.totalPages).toBe(Math.ceil(pagination.total / 2));
    });

    it.each(['page=0', 'limit=-1', 'limit=1000', 'page=abc'])(
      'Scenario 06: rejects invalid pagination %s with 400',
      (query) => api(SUPERVISOR).get(`/requests?${query}`).expect(400),
    );

    it('Scenario 07: rejects "from" later than "to" with 400', () =>
      api(SUPERVISOR)
        .get('/requests?from=2026-10-31T00:00:00Z&to=2026-10-01T00:00:00Z')
        .expect(400));
  });

  describe('status changes with version', () => {
    it('Scenario 08: a current version updates status, version and history', async () => {
      const created = await createRequest(ADVISOR_ONE);
      const res = await api(ADVISOR_ONE)
        .patch(`/requests/${created.id}/status`, {
          status: 'IN_PROGRESS',
          expectedVersion: 1,
        })
        .expect(200);
      expect(res.body.data).toMatchObject({
        status: 'IN_PROGRESS',
        version: 2,
      });
      expect(await historyTypes(created.id)).toEqual([
        'CREATION',
        'ASSIGNMENT',
        'STATUS',
      ]);
    });

    it('Scenario 09: an outdated version returns 409 without changes', async () => {
      const created = await createRequest(ADVISOR_ONE);
      const res = await api(ADVISOR_ONE)
        .patch(`/requests/${created.id}/status`, {
          status: 'IN_PROGRESS',
          expectedVersion: 5,
        })
        .expect(409);
      expect(res.body).toMatchObject({
        success: false,
        statusCode: 409,
        message:
          'The request was modified by another user. Fetch the current version.',
        path: `/requests/${created.id}/status`,
      });
      const current = await api(ADMIN)
        .get(`/requests/${created.id}`)
        .expect(200);
      expect(current.body.data).toMatchObject({
        status: 'PENDING',
        version: 1,
      });
    });

    it('two simultaneous changes with the same version: one succeeds, the other gets 409', async () => {
      const created = await createRequest(SUPERVISOR);
      const body = { status: 'IN_PROGRESS', expectedVersion: 1 };
      const responses = await Promise.all([
        api(SUPERVISOR).patch(`/requests/${created.id}/status`, body),
        api(ADMIN).patch(`/requests/${created.id}/status`, body),
      ]);
      expect(responses.map((res) => res.status).sort()).toEqual([200, 409]);
      expect(await historyTypes(created.id)).toEqual(['CREATION', 'STATUS']);
    });

    it('rejects an invalid transition with 400', async () => {
      const created = await createRequest(ADVISOR_ONE);
      await api(ADVISOR_ONE)
        .patch(`/requests/${created.id}/status`, {
          status: 'RESOLVED',
          expectedVersion: 1,
        })
        .expect(400);
    });

    it('Scenario 10: a history failure rolls back status and version', async () => {
      const created = await createRequest(SUPERVISOR);
      let failedTarget: unknown;
      // The first insert after the status update is the history event: make it fail.
      const insertSpy = jest
        .spyOn(EntityManager.prototype, 'insert')
        .mockImplementationOnce(async (target: unknown) => {
          failedTarget = target;
          throw new Error('Simulated history failure');
        });
      try {
        await api(SUPERVISOR)
          .patch(`/requests/${created.id}/status`, {
            status: 'IN_PROGRESS',
            expectedVersion: 1,
          })
          .expect(500);
      } finally {
        insertSpy.mockRestore();
      }
      expect(failedTarget).toBe(RequestHistory);
      const current = await api(ADMIN)
        .get(`/requests/${created.id}`)
        .expect(200);
      expect(current.body.data).toMatchObject({
        status: 'PENDING',
        version: 1,
      });
      expect(await historyTypes(created.id)).toEqual(['CREATION']);
    });
  });

  describe('access to detail and history', () => {
    it('Scenario 11: an advisor cannot read the detail or history of another advisor request (404)', async () => {
      const created = await createRequest(ADVISOR_ONE);
      await api(ADVISOR_TWO).get(`/requests/${created.id}`).expect(404);
      await api(ADVISOR_TWO).get(`/requests/${created.id}/history`).expect(404);
      await api(ADVISOR_ONE).get(`/requests/${created.id}/history`).expect(200);
    });

    it('an advisor cannot change the status of another advisor request', async () => {
      const created = await createRequest(ADVISOR_ONE);
      await api(ADVISOR_TWO)
        .patch(`/requests/${created.id}/status`, {
          status: 'IN_PROGRESS',
          expectedVersion: 1,
        })
        .expect(404);
    });
  });
});
