import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './dao/user.entity.js';
import { SampleDataSeedService } from './sample-data-seed.service.js';
import { Client } from '../clients/dao/client.entity.js';
import { Request } from '../solicitudes/dao/request.entity.js';
import { StatusHistory } from '../solicitudes/dao/status-history.entity.js';
@Module({
  imports: [TypeOrmModule.forFeature([User, Client, Request, StatusHistory])],
  providers: [SampleDataSeedService],
  exports: [TypeOrmModule],
})
export class UsersModule {}
