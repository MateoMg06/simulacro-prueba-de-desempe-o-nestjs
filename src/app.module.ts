import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import pg from 'pg';
import { RequestsModule } from './requests/requests.module.js';
import { UsersModule } from './users/users.module.js';
import { ClientsModule } from './clients/clients.module.js';
import { User } from './users/dao/user.entity.js';
import { Client } from './clients/dao/client.entity.js';
import { Request } from './requests/dao/request.entity.js';
import { RequestHistory } from './requests/dao/request-history.entity.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        // Passed explicitly so TypeORM does not need to require() it (fails under Jest ESM).
        driver: pg,
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USERNAME', 'postgres'),
        password: config.get<string>('DB_PASSWORD', ''),
        database: config.get<string>('DB_DATABASE', 'commercial_requests'),
        entities: [User, Client, Request, RequestHistory],
        synchronize: config.get<string>('DB_SYNCHRONIZE', 'true') === 'true',
      }),
    }),
    UsersModule,
    ClientsModule,
    RequestsModule,
  ],
})
export class AppModule {}
