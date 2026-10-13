import { describe, expect, it } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateRequestDto } from './create-request.dto.js';
import { ListRequestsQueryDto } from './list-requests-query.dto.js';
import { UpdateStatusDto } from './update-status.dto.js';

async function errorsFor(dtoClass: any, plain: object) {
  const dto = plainToInstance(dtoClass, plain);
  return { dto, errors: await validate(dto as object) };
}

describe('Request DTOs', () => {
  it('normalizes spaces in the description', async () => {
    const { dto, errors } = await errorsFor(CreateRequestDto, {
      clientId: 1,
      description: '  Call   the   client  ',
    });
    expect(errors).toHaveLength(0);
    expect((dto as CreateRequestDto).description).toBe('Call the client');
  });

  it('rejects a description made only of spaces', async () => {
    const { errors } = await errorsFor(CreateRequestDto, {
      clientId: 1,
      description: '    ',
    });
    expect(errors.map((e) => e.property)).toContain('description');
  });

  it('uses page=1 and limit=10 by default', async () => {
    const { dto, errors } = await errorsFor(ListRequestsQueryDto, {});
    expect(errors).toHaveLength(0);
    expect(dto).toMatchObject({ page: 1, limit: 10 });
  });

  it.each([
    { page: '0' },
    { limit: '-1' },
    { limit: '1000' },
    { page: 'abc' },
    { from: 'not-a-date' },
    { status: 'CLOSED' },
    { client: null },
    { page: null },
  ])('rejects invalid query %o', async (query) => {
    const { errors } = await errorsFor(ListRequestsQueryDto, query);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('requires expectedVersion to change the status', async () => {
    const { errors } = await errorsFor(UpdateStatusDto, {
      status: 'IN_PROGRESS',
    });
    expect(errors.map((e) => e.property)).toContain('expectedVersion');
  });
});
