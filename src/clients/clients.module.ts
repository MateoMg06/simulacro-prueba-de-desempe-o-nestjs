import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from './dao/client.entity.js';
import { ClientsController } from './clients.controller.js';
import { ApiKeyGuard } from '../auth/guards/api-key.guard.js';
import { UserGuard } from '../auth/guards/user.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { User } from '../users/dao/user.entity.js';
import { ClientsService } from './clients.service.js';
@Module({
  imports: [TypeOrmModule.forFeature([Client, User])],
  controllers: [ClientsController],
  providers: [ApiKeyGuard, UserGuard, RolesGuard, ClientsService],
})
export class ClientsModule {}
