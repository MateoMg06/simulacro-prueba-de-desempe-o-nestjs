import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RequestsService } from './requests.service.js';
import { RequestStatus } from './dao/request-status.enum.js';

describe('RequestsService', () => {
  const client = { id: 1, name: 'Acme' };
  const user = { id: '3', role: 'advisor' } as any;
  const requestRepository = {
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn((value) => Promise.resolve(value)),
    find: jest.fn(),
  };
  const historyRepository = {
    create: jest.fn((value) => value),
    save: jest.fn((value) => Promise.resolve(value)),
  };
  const clientRepository = { findOne: jest.fn() };
  const userRepository = { findOne: jest.fn() };
  let service: RequestsService;
  beforeEach(() => {
    jest.clearAllMocks();
    service = new RequestsService(
      requestRepository as any,
      historyRepository as any,
      clientRepository as any,
      userRepository as any,
    );
  });
  it('creates a request with PENDING status and current advisor', async () => {
    clientRepository.findOne.mockResolvedValue(client);
    userRepository.findOne.mockResolvedValue(user);
    const result = await service.create(
      { clientId: 1, description: 'Call client' },
      user,
    );
    expect(result).toMatchObject({
      status: RequestStatus.PENDING,
      advisor: user,
      client,
    });
    expect(requestRepository.save).toHaveBeenCalled();
  });
  it('rejects unknown clients', async () => {
    clientRepository.findOne.mockResolvedValue(null);
    await expect(
      service.create({ clientId: 99, description: 'Call' }, user),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
  it('does not let an advisor assign a request to another user', async () => {
    clientRepository.findOne.mockResolvedValue(client);
    userRepository.findOne.mockResolvedValue(user);
    const result = await service.create(
      { clientId: 1, description: 'Call client', advisorId: '4' },
      user,
    );
    expect(userRepository.findOne).toHaveBeenCalledWith({
      where: { id: '3', active: true, role: 'advisor' },
    });
    expect(result.advisor).toBe(user);
  });
  it('allows a supervisor to assign a request to an advisor', async () => {
    clientRepository.findOne.mockResolvedValue(client);
    const advisor = { id: '4', role: 'advisor' };
    userRepository.findOne.mockResolvedValue(advisor);
    const supervisor = { id: '2', role: 'supervisor' } as any;
    const result = await service.create(
      { clientId: 1, description: 'Call client', advisorId: '4' },
      supervisor,
    );
    expect(userRepository.findOne).toHaveBeenCalledWith({
      where: { id: '4', active: true, role: 'advisor' },
    });
    expect(result.advisor).toBe(advisor);
  });
  it('records a valid status change in history', async () => {
    requestRepository.findOne.mockResolvedValue({
      id: 1,
      status: RequestStatus.PENDING,
      advisor: user,
    });
    await service.updateStatus(1, RequestStatus.IN_PROGRESS, user);
    expect(historyRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        previousStatus: RequestStatus.PENDING,
        newStatus: RequestStatus.IN_PROGRESS,
        changedBy: user,
      }),
    );
  });
  it('rejects invalid status transitions', async () => {
    requestRepository.findOne.mockResolvedValue({
      id: 1,
      status: RequestStatus.PENDING,
      advisor: user,
    });
    await expect(
      service.updateStatus(1, RequestStatus.RESOLVED, user),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('limits advisor lookup to owned requests', async () => {
    requestRepository.findOne.mockResolvedValue({ id: 1 });
    await service.findOne(1, user);
    expect(requestRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1, advisor: { id: '3' } } }),
    );
  });
});
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
