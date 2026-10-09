import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CreateClientDto } from './dto/create-client.dto.js';
import { ApiKeyGuard } from '../auth/guards/api-key.guard.js';
import { UserGuard } from '../auth/guards/user.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ClientsService } from './clients.service.js';

@ApiTags('Clients')
@ApiSecurity('api-key')
@ApiUnauthorizedResponse({ description: 'Missing or invalid API key or user' })
@ApiHeader({
  name: 'x-user',
  required: true,
  example: '1',
  description: 'Existing user ID',
})
@Controller('clients')
@UseGuards(ApiKeyGuard, UserGuard, RolesGuard)
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}
  @Post()
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Create a client' })
  @ApiCreatedResponse({ description: 'Client created successfully' })
  @ApiForbiddenResponse({
    description: 'Only admins and supervisors can create clients',
  })
  create(@Body() dto: CreateClientDto) {
    return this.clients.create(dto);
  }
  @Get()
  @ApiOperation({ summary: 'List clients' })
  @ApiOkResponse({ description: 'Clients returned successfully' })
  list() {
    return this.clients.list();
  }
}
