import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Request } from './dao/request.entity.js';
import { RequestStatus } from './dao/request-status.enum.js';
import { RequestHistory } from './dao/request-history.entity.js';
import { HistoryEventType } from './dao/history-event-type.enum.js';
import { Client } from '../clients/dao/client.entity.js';
import { User } from '../users/dao/user.entity.js';
import { CreateRequestDto } from './dto/create-request.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';
import { AssignRequestDto } from './dto/assign-request.dto.js';
import { ListRequestsQueryDto } from './dto/list-requests-query.dto.js';

export const STALE_VERSION_MESSAGE =
  'The request was modified by another user. Fetch the current version.';

const ALLOWED_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  [RequestStatus.PENDING]: [RequestStatus.IN_PROGRESS],
  [RequestStatus.IN_PROGRESS]: [RequestStatus.RESOLVED],
  [RequestStatus.RESOLVED]: [],
};

export interface PaginatedRequests {
  items: Request[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class RequestsService {
  constructor(
    @InjectRepository(Request) private readonly requests: Repository<Request>,
    @InjectRepository(RequestHistory)
    private readonly history: Repository<RequestHistory>,
    @InjectRepository(Client) private readonly clients: Repository<Client>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateRequestDto, currentUser: User): Promise<Request> {
    const client = await this.clients.findOne({ where: { id: dto.clientId } });
    if (!client)
      throw new NotFoundException(`Client ${dto.clientId} was not found`);
    // Advisors own the requests they create; admins and supervisors leave them unassigned.
    const advisor = currentUser.role === 'advisor' ? currentUser : null;
    const requestId = await this.dataSource.transaction(async (manager) => {
      const request = await manager.save(
        manager.create(Request, {
          description: dto.description,
          client,
          advisor,
          status: RequestStatus.PENDING,
          version: 1,
        }),
      );
      await this.addHistory(
        manager,
        request.id,
        HistoryEventType.CREATION,
        null,
        RequestStatus.PENDING,
        currentUser,
      );
      if (advisor) {
        await this.addHistory(
          manager,
          request.id,
          HistoryEventType.ASSIGNMENT,
          null,
          advisor.id,
          currentUser,
        );
      }
      return request.id;
    });
    return this.findOne(requestId, currentUser);
  }

  async list(
    query: ListRequestsQueryDto,
    currentUser: User,
  ): Promise<PaginatedRequests> {
    if (query.from && query.to && new Date(query.from) > new Date(query.to)) {
      throw new BadRequestException('"from" must not be later than "to"');
    }
    const builder = this.requests
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.advisor', 'advisor')
      .leftJoinAndSelect('request.client', 'client');
    // The permission rule is always applied; filters are added with AND so they can only narrow it.
    if (currentUser.role === 'advisor') {
      builder.andWhere('advisor.id = :currentUserId', {
        currentUserId: currentUser.id,
      });
    }
    if (query.status) {
      builder.andWhere('request.status = :status', { status: query.status });
    }
    if (query.advisor) {
      builder.andWhere('advisor.id = :advisorId', { advisorId: query.advisor });
    }
    if (query.client) {
      const escaped = query.client.replace(/[\\%_]/g, '\\$&');
      builder.andWhere('client.name ILIKE :client', { client: `%${escaped}%` });
    }
    if (query.from) {
      builder.andWhere('request.createdAt >= :from', {
        from: new Date(query.from),
      });
    }
    if (query.to) {
      builder.andWhere('request.createdAt <= :to', { to: new Date(query.to) });
    }
    const [items, total] = await builder
      .orderBy('request.createdAt', 'DESC')
      .addOrderBy('request.id', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return {
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  // Advisors only see requests currently assigned to them; others get 404.
  async findOne(id: number, currentUser: User): Promise<Request> {
    const where =
      currentUser.role === 'advisor'
        ? { id, advisor: { id: currentUser.id } }
        : { id };
    const request = await this.requests.findOne({
      where,
      relations: { advisor: true, client: true },
    });
    if (!request) throw new NotFoundException(`Request ${id} was not found`);
    return request;
  }

  async updateStatus(
    id: number,
    dto: UpdateStatusDto,
    currentUser: User,
  ): Promise<Request> {
    const request = await this.findOne(id, currentUser);
    if (request.version !== dto.expectedVersion) {
      throw new ConflictException(STALE_VERSION_MESSAGE);
    }
    if (!ALLOWED_TRANSITIONS[request.status].includes(dto.status)) {
      throw new BadRequestException(
        `Transition from ${request.status} to ${dto.status} is not allowed`,
      );
    }
    await this.dataSource.transaction(async (manager) => {
      // Conditional update: only succeeds if nobody changed the version in the meantime.
      const result = await manager.update(
        Request,
        { id, version: dto.expectedVersion },
        { status: dto.status, version: dto.expectedVersion + 1 },
      );
      if (result.affected === 0) {
        throw new ConflictException(STALE_VERSION_MESSAGE);
      }
      await this.addHistory(
        manager,
        id,
        HistoryEventType.STATUS,
        request.status,
        dto.status,
        currentUser,
      );
    });
    return this.findOne(id, currentUser);
  }

  async assign(
    id: number,
    dto: AssignRequestDto,
    currentUser: User,
  ): Promise<Request> {
    const request = await this.requests.findOne({
      where: { id },
      relations: { advisor: true },
    });
    if (!request) throw new NotFoundException(`Request ${id} was not found`);
    if (request.status === RequestStatus.RESOLVED) {
      throw new ConflictException('A RESOLVED request cannot be reassigned');
    }
    const advisor = await this.users.findOne({
      where: { id: dto.advisorId, role: 'advisor', active: true },
    });
    if (!advisor) {
      throw new BadRequestException(
        `User ${dto.advisorId} does not exist or is not an active advisor`,
      );
    }
    await this.dataSource.transaction(async (manager) => {
      // The status is not touched; the version grows because the record changed.
      const result = await manager.update(
        Request,
        { id, version: request.version },
        { advisor: { id: advisor.id }, version: request.version + 1 },
      );
      if (result.affected === 0) {
        throw new ConflictException(STALE_VERSION_MESSAGE);
      }
      await this.addHistory(
        manager,
        id,
        HistoryEventType.ASSIGNMENT,
        request.advisor?.id ?? null,
        advisor.id,
        currentUser,
      );
    });
    return this.findOne(id, currentUser);
  }

  async findHistory(id: number, currentUser: User): Promise<RequestHistory[]> {
    // Reuses the same permission check as the detail endpoint.
    await this.findOne(id, currentUser);
    return this.history.find({
      where: { requestId: id },
      relations: { actor: true },
      order: { eventDate: 'ASC', id: 'ASC' },
    });
  }

  // Always called with the transaction manager, so the event and the change commit together.
  private async addHistory(
    manager: EntityManager,
    requestId: number,
    eventType: HistoryEventType,
    previousValue: string | null,
    newValue: string,
    actor: User,
  ): Promise<void> {
    await manager.insert(RequestHistory, {
      requestId,
      eventType,
      previousValue,
      newValue,
      actor: { id: actor.id },
    });
  }
}
