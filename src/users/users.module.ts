import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './dao/user.entity.js';
import { SampleDataSeedService } from './sample-data-seed.service.js';
import { Client } from '../clients/dao/client.entity.js';
import { Request } from '../requests/dao/request.entity.js';
import { RequestHistory } from '../requests/dao/request-history.entity.js';
@Module({
  imports: [TypeOrmModule.forFeature([User, Client, Request, RequestHistory])],
  providers: [SampleDataSeedService],
  exports: [TypeOrmModule],
})
export class UsersModule {}
