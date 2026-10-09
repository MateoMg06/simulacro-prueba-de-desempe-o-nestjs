import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../clients/dao/client.entity.js';
import { Request } from '../requests/dao/request.entity.js';
import { RequestStatus } from '../requests/dao/request-status.enum.js';
import { StatusHistory } from '../requests/dao/status-history.entity.js';
import { User } from './dao/user.entity.js';

@Injectable()
export class SampleDataSeedService implements OnModuleInit {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Client) private readonly clients: Repository<Client>,
    @InjectRepository(Request) private readonly requests: Repository<Request>,
    @InjectRepository(StatusHistory)
    private readonly statusHistory: Repository<StatusHistory>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedUsers();
    await this.seedClientRequestAndHistory();
  }

  private async seedUsers(): Promise<void> {
    const sampleUsers: User[] = [
      {
        id: '1',
        name: 'System Admin',
        email: 'admin@example.test',
        role: 'admin',
        active: true,
        requests: [],
      },
      {
        id: '2',
        name: 'Sales Supervisor',
        email: 'supervisor@example.test',
        role: 'supervisor',
        active: true,
        requests: [],
      },
      {
        id: '3',
        name: 'Advisor One',
        email: 'advisor1@example.test',
        role: 'advisor',
        active: true,
        requests: [],
      },
      {
        id: '4',
        name: 'Advisor Two',
        email: 'advisor2@example.test',
        role: 'advisor',
        active: true,
        requests: [],
      },
    ];

    for (const user of sampleUsers) {
      if (!(await this.users.exists({ where: { id: user.id } }))) {
        await this.users.save(user);
      }
    }
  }

  private async seedClientRequestAndHistory(): Promise<void> {
    let client = await this.clients.findOne({
      where: { document: 'DEMO-CLIENT-001' },
    });
    if (!client) {
      client = await this.clients.save(
        this.clients.create({
          name: 'Acme Demo Client',
          email: 'contact@acme.example.test',
          phone: '+1-555-0100',
          document: 'DEMO-CLIENT-001',
        }),
      );
    }

    const advisor = await this.users.findOneByOrFail({ id: '3' });
    const supervisor = await this.users.findOneByOrFail({ id: '2' });
    let request = await this.requests.findOne({
      where: {
        description: 'Demo follow-up for the annual services proposal',
        client: { id: client.id },
        advisor: { id: advisor.id },
      },
    });
    if (!request) {
      request = await this.requests.save(
        this.requests.create({
          description: 'Demo follow-up for the annual services proposal',
          status: RequestStatus.IN_PROGRESS,
          client,
          advisor,
        }),
      );
    }

    const historyExists = await this.statusHistory.exists({
      where: {
        request: { id: request.id },
        previousStatus: RequestStatus.PENDING,
        newStatus: RequestStatus.IN_PROGRESS,
      },
    });
    if (!historyExists) {
      await this.statusHistory.save(
        this.statusHistory.create({
          request,
          previousStatus: RequestStatus.PENDING,
          newStatus: RequestStatus.IN_PROGRESS,
          changedBy: supervisor,
        }),
      );
    }
  }
}
