import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestsController } from './requests.controller.js';
import { RequestsService } from './requests.service.js';
import { Request } from './dao/request.entity.js';
import { StatusHistory } from './dao/status-history.entity.js';
import { Client } from '../clients/dao/client.entity.js';
import { User } from '../users/dao/user.entity.js';
import { ApiKeyGuard } from '../auth/guards/api-key.guard.js';
import { UserGuard } from '../auth/guards/user.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
@Module({
  imports: [TypeOrmModule.forFeature([Request, StatusHistory, Client, User])],
  controllers: [RequestsController],
  providers: [RequestsService, ApiKeyGuard, UserGuard, RolesGuard],
})
export class RequestsModule {}
