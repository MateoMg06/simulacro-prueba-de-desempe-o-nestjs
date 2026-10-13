import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../clients/dao/client.entity.js';
import { Request } from '../requests/dao/request.entity.js';
import { RequestStatus } from '../requests/dao/request-status.enum.js';
import { RequestHistory } from '../requests/dao/request-history.entity.js';
import { HistoryEventType } from '../requests/dao/history-event-type.enum.js';
import { User } from './dao/user.entity.js';

@Injectable()
export class SampleDataSeedService implements OnModuleInit {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Client) private readonly clients: Repository<Client>,
    @InjectRepository(Request) private readonly requests: Repository<Request>,
    @InjectRepository(RequestHistory)
    private readonly history: Repository<RequestHistory>,
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
          version: 2,
          client,
          advisor,
        }),
      );
    }

    const historyExists = await this.history.exists({
      where: { requestId: request.id },
    });
    if (!historyExists) {
      await this.history.save([
        this.history.create({
          requestId: request.id,
          eventType: HistoryEventType.CREATION,
          previousValue: null,
          newValue: RequestStatus.PENDING,
          actor: advisor,
        }),
        this.history.create({
          requestId: request.id,
          eventType: HistoryEventType.ASSIGNMENT,
          previousValue: null,
          newValue: advisor.id,
          actor: advisor,
        }),
        this.history.create({
          requestId: request.id,
          eventType: HistoryEventType.STATUS,
          previousValue: RequestStatus.PENDING,
          newValue: RequestStatus.IN_PROGRESS,
          actor: supervisor,
        }),
      ]);
    }
  }
}
