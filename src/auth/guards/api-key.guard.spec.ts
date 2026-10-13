import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiKeyGuard } from './api-key.guard.js';

describe('ApiKeyGuard', () => {
  const config = {
    get: jest.fn().mockReturnValue('first_key, second_key'),
  } as unknown as ConfigService;
  const guard = new ApiKeyGuard(config);
  const makeContext = (apiKey?: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers: apiKey ? { 'x-api-key': apiKey } : {} }),
      }),
    }) as ExecutionContext;
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it('accepts each configured API key', () => {
    expect(guard.canActivate(makeContext('first_key'))).toBe(true);
    expect(guard.canActivate(makeContext('second_key'))).toBe(true);
  });
  it('rejects a missing or unknown API key', () => {
    expect(() => guard.canActivate(makeContext())).toThrow(
      UnauthorizedException,
    );
    expect(() => guard.canActivate(makeContext('wrong_key'))).toThrow(
      UnauthorizedException,
    );
  });
});
