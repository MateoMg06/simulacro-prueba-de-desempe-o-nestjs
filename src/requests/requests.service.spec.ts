import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { RequestsService } from './requests.service.js';
import { RequestStatus } from './dao/request-status.enum.js';
import { HistoryEventType } from './dao/history-event-type.enum.js';
import { RequestHistory } from './dao/request-history.entity.js';

describe('RequestsService', () => {
  const client = { id: 1, name: 'Acme' };
  const advisor = { id: '3', role: 'advisor' } as any;
  const supervisor = { id: '2', role: 'supervisor' } as any;

  // Chainable query builder mock that records the where clauses.
  const queryBuilder: any = {
    leftJoinAndSelect: jest.fn(() => queryBuilder),
    andWhere: jest.fn(() => queryBuilder),
    orderBy: jest.fn(() => queryBuilder),
    addOrderBy: jest.fn(() => queryBuilder),
    skip: jest.fn(() => queryBuilder),
    take: jest.fn(() => queryBuilder),
    getManyAndCount: jest.fn(),
  };
  const requestRepository: any = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => queryBuilder),
  };
  const historyRepository: any = { find: jest.fn() };
  const clientRepository: any = { findOne: jest.fn() };
  const userRepository: any = { findOne: jest.fn() };
  // The transaction mock runs the callback with a fake EntityManager.
  const manager: any = {
    create: jest.fn((_entity, value) => value),
    save: jest.fn((value: any) => Promise.resolve({ id: 10, ...value })),
    update: jest.fn(),
    insert: jest.fn(),
  };
  const dataSource: any = {
    transaction: jest.fn((callback: any) => callback(manager)),
  };
  let service: RequestsService;

  beforeEach(() => {
    jest.clearAllMocks();
    manager.update.mockResolvedValue({ affected: 1 });
    manager.insert.mockResolvedValue({});
    service = new RequestsService(
      requestRepository,
      historyRepository,
      clientRepository,
      userRepository,
      dataSource,
    );
  });

  const eventTypes = () =>
    manager.insert.mock.calls.map(([, event]: any) => event.eventType);

  describe('create', () => {
    it('assigns an advisor request to its creator and records CREATION + ASSIGNMENT', async () => {
      clientRepository.findOne.mockResolvedValue(client);
      requestRepository.findOne.mockResolvedValue({ id: 10 });
      await service.create(
        { clientId: 1, description: 'Call client' },
        advisor,
      );
      expect(manager.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: RequestStatus.PENDING,
          advisor,
          version: 1,
        }),
      );
      expect(manager.insert).toHaveBeenCalledWith(
        RequestHistory,
        expect.objectContaining({
          requestId: 10,
          eventType: HistoryEventType.CREATION,
          previousValue: null,
          newValue: RequestStatus.PENDING,
        }),
      );
      expect(eventTypes()).toEqual([
        HistoryEventType.CREATION,
        HistoryEventType.ASSIGNMENT,
      ]);
    });

    it('leaves a supervisor request unassigned with only a CREATION event', async () => {
      clientRepository.findOne.mockResolvedValue(client);
      requestRepository.findOne.mockResolvedValue({ id: 10 });
      await service.create(
        { clientId: 1, description: 'Call client' },
        supervisor,
      );
      expect(manager.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: RequestStatus.PENDING,
          advisor: null,
        }),
      );
      expect(eventTypes()).toEqual([HistoryEventType.CREATION]);
    });

    it('rejects unknown clients', async () => {
      clientRepository.findOne.mockResolvedValue(null);
      await expect(
        service.create({ clientId: 99, description: 'Call' }, advisor),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    beforeEach(() => queryBuilder.getManyAndCount.mockResolvedValue([[], 0]));

    it('always restricts advisors to their own requests, even with another advisor filter', async () => {
      await service.list({ advisor: '4', page: 1, limit: 10 }, advisor);
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'advisor.id = :currentUserId',
        { currentUserId: '3' },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'advisor.id = :advisorId',
        { advisorId: '4' },
      );
    });

    it('does not restrict supervisors', async () => {
      await service.list({ page: 1, limit: 10 }, supervisor);
      expect(queryBuilder.andWhere).not.toHaveBeenCalled();
    });

    it('applies filters and pagination in the query', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[{ id: 1 }], 21]);
      const result = await service.list(
        {
          status: RequestStatus.IN_PROGRESS,
          client: 'nor',
          from: '2026-10-01T00:00:00Z',
          to: '2026-10-31T23:59:59Z',
          page: 2,
          limit: 10,
        },
        supervisor,
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'request.status = :status',
        { status: RequestStatus.IN_PROGRESS },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'client.name ILIKE :client',
        { client: '%nor%' },
      );
      expect(queryBuilder.skip).toHaveBeenCalledWith(10);
      expect(queryBuilder.take).toHaveBeenCalledWith(10);
      expect(result.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 21,
        totalPages: 3,
      });
    });

    it('rejects "from" later than "to"', async () => {
      await expect(
        service.list(
          {
            from: '2026-10-31T00:00:00Z',
            to: '2026-10-01T00:00:00Z',
            page: 1,
            limit: 10,
          },
          supervisor,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(queryBuilder.getManyAndCount).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('limits advisor lookup to owned requests', async () => {
      requestRepository.findOne.mockResolvedValue({ id: 1 });
      await service.findOne(1, advisor);
      expect(requestRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1, advisor: { id: '3' } } }),
      );
    });
  });

  describe('updateStatus', () => {
    const pending = () => ({
      id: 1,
      status: RequestStatus.PENDING,
      version: 1,
      advisor,
    });

    it('updates status, increases version and records a STATUS event in one transaction', async () => {
      requestRepository.findOne.mockResolvedValue(pending());
      await service.updateStatus(
        1,
        { status: RequestStatus.IN_PROGRESS, expectedVersion: 1 },
        advisor,
      );
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(manager.update).toHaveBeenCalledWith(
        expect.anything(),
        { id: 1, version: 1 },
        { status: RequestStatus.IN_PROGRESS, version: 2 },
      );
      expect(manager.insert).toHaveBeenCalledWith(
        RequestHistory,
        expect.objectContaining({
          eventType: HistoryEventType.STATUS,
          previousValue: RequestStatus.PENDING,
          newValue: RequestStatus.IN_PROGRESS,
          actor: { id: '3' },
        }),
      );
    });

    it('rejects an outdated expected version with 409 and writes nothing', async () => {
      requestRepository.findOne.mockResolvedValue({ ...pending(), version: 2 });
      await expect(
        service.updateStatus(
          1,
          { status: RequestStatus.IN_PROGRESS, expectedVersion: 1 },
          advisor,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('returns 409 when another user changed the row during the update', async () => {
      requestRepository.findOne.mockResolvedValue(pending());
      manager.update.mockResolvedValue({ affected: 0 });
      await expect(
        service.updateStatus(
          1,
          { status: RequestStatus.IN_PROGRESS, expectedVersion: 1 },
          advisor,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(manager.insert).not.toHaveBeenCalled();
    });

    it('propagates a history failure so the transaction is rolled back', async () => {
      requestRepository.findOne.mockResolvedValue(pending());
      manager.insert.mockRejectedValue(new Error('history insert failed'));
      await expect(
        service.updateStatus(
          1,
          { status: RequestStatus.IN_PROGRESS, expectedVersion: 1 },
          advisor,
        ),
      ).rejects.toThrow('history insert failed');
      // The status update ran with the same transactional manager that failed.
      expect(manager.update).toHaveBeenCalled();
    });

    it('rejects invalid status transitions', async () => {
      requestRepository.findOne.mockResolvedValue(pending());
      await expect(
        service.updateStatus(
          1,
          { status: RequestStatus.RESOLVED, expectedVersion: 1 },
          advisor,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('assign', () => {
    it('assigns an active advisor without changing status and records ASSIGNMENT', async () => {
      requestRepository.findOne.mockResolvedValue({
        id: 1,
        status: RequestStatus.PENDING,
        version: 1,
        advisor: null,
      });
      userRepository.findOne.mockResolvedValue({ id: '4', role: 'advisor' });
      await service.assign(1, { advisorId: '4' }, supervisor);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: '4', role: 'advisor', active: true },
      });
      expect(manager.update).toHaveBeenCalledWith(
        expect.anything(),
        { id: 1, version: 1 },
        { advisor: { id: '4' }, version: 2 },
      );
      expect(manager.insert).toHaveBeenCalledWith(
        RequestHistory,
        expect.objectContaining({
          eventType: HistoryEventType.ASSIGNMENT,
          previousValue: null,
          newValue: '4',
          actor: { id: '2' },
        }),
      );
    });

    it('rejects users that are not active advisors', async () => {
      requestRepository.findOne.mockResolvedValue({
        id: 1,
        status: RequestStatus.PENDING,
        version: 1,
        advisor: null,
      });
      userRepository.findOne.mockResolvedValue(null);
      await expect(
        service.assign(1, { advisorId: '2' }, supervisor),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('rejects reassigning a RESOLVED request with 409', async () => {
      requestRepository.findOne.mockResolvedValue({
        id: 1,
        status: RequestStatus.RESOLVED,
        version: 3,
        advisor,
      });
      await expect(
        service.assign(1, { advisorId: '4' }, supervisor),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('returns 404 for unknown requests', async () => {
      requestRepository.findOne.mockResolvedValue(null);
      await expect(
        service.assign(99, { advisorId: '4' }, supervisor),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findHistory', () => {
    it('checks access before reading the history', async () => {
      requestRepository.findOne.mockResolvedValue(null);
      await expect(service.findHistory(1, advisor)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(historyRepository.find).not.toHaveBeenCalled();
    });

    it('returns events ordered by date', async () => {
      requestRepository.findOne.mockResolvedValue({ id: 1 });
      historyRepository.find.mockResolvedValue([]);
      await service.findHistory(1, supervisor);
      expect(historyRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { requestId: 1 },
          order: { eventDate: 'ASC', id: 'ASC' },
        }),
      );
    });
  });
});
