import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from './dao/client.entity.js';
import { CreateClientDto } from './dto/create-client.dto.js';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private readonly clientsRepository: Repository<Client>,
  ) {}

  create(dto: CreateClientDto): Promise<Client> {
    const client = this.clientsRepository.create(dto);
    return this.clientsRepository.save(client);
  }

  list(): Promise<Client[]> {
    return this.clientsRepository.find({ order: { name: 'ASC' } });
  }
}
