import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';

describe('Requests API (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('protects request endpoints when the API key is missing', () => {
    return request(app.getHttpServer())
      .get('/requests')
      .expect(401)
      .expect(({ body }) =>
        expect(body).toMatchObject({ success: false, statusCode: 401 }),
      );
  });

  afterEach(async () => {
    await app.close();
  });
});
