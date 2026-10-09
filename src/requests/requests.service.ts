import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from './dao/request.entity.js';
import { RequestStatus } from './dao/request-status.enum.js';
import { StatusHistory } from './dao/status-history.entity.js';
import { Client } from '../clients/dao/client.entity.js';
import { User } from '../users/dao/user.entity.js';
import { CreateRequestDto } from './dto/create-request.dto.js';

@Injectable()
export class RequestsService {
  constructor(
    @InjectRepository(Request) private readonly requests: Repository<Request>,
    @InjectRepository(StatusHistory)
    private readonly history: Repository<StatusHistory>,
    @InjectRepository(Client) private readonly clients: Repository<Client>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}
  async create(dto: CreateRequestDto, currentUser: User): Promise<Request> {
    const client = await this.clients.findOne({ where: { id: dto.clientId } });
    if (!client)
      throw new NotFoundException(`Client ${dto.clientId} was not found`);
    const advisorId =
      currentUser.role === 'advisor' ? currentUser.id : dto.advisorId;
    const advisor = advisorId
      ? await this.users.findOne({
          where: { id: advisorId, active: true, role: 'advisor' },
        })
      : await this.users.findOne({ where: { active: true, role: 'advisor' } });
    if (!advisor)
      throw new NotFoundException(
        advisorId
          ? `Advisor ${advisorId} was not found`
          : 'No active advisor was found',
      );
    const request = this.requests.create({
      description: dto.description,
      client,
      advisor,
      status: RequestStatus.PENDING,
    });
    return this.requests.save(request);
  }
  list(currentUser: User): Promise<Request[]> {
    return this.requests.find({
      where:
        currentUser.role === 'advisor'
          ? { advisor: { id: currentUser.id } }
          : {},
      relations: { advisor: true, client: true },
      order: { createdAt: 'DESC' },
    });
  }
  async findOne(id: number, currentUser: User): Promise<Request> {
    const where =
      currentUser.role === 'advisor'
        ? { id, advisor: { id: currentUser.id } }
        : { id };
    const request = await this.requests.findOne({
      where,
      relations: { advisor: true, client: true, history: { changedBy: true } },
    });
    if (!request) throw new NotFoundException(`Request ${id} was not found`);
    return request;
  }
  async updateStatus(
    id: number,
    newStatus: RequestStatus,
    currentUser: User,
  ): Promise<Request> {
    const request = await this.findOne(id, currentUser);
    const transitions: Record<RequestStatus, RequestStatus[]> = {
      [RequestStatus.PENDING]: [RequestStatus.IN_PROGRESS],
      [RequestStatus.IN_PROGRESS]: [RequestStatus.RESOLVED],
      [RequestStatus.RESOLVED]: [],
    };
    if (!transitions[request.status].includes(newStatus))
      throw new BadRequestException(
        `Transition from ${request.status} to ${newStatus} is not allowed`,
      );
    const previousStatus = request.status;
    request.status = newStatus;
    await this.requests.save(request);
    await this.history.save(
      this.history.create({
        request,
        previousStatus,
        newStatus,
        changedBy: currentUser,
      }),
    );
    return this.findOne(id, currentUser);
  }
}
