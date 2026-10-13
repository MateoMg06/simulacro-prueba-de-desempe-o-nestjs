import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/guards/api-key.guard.js';
import { UserGuard } from '../auth/guards/user.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../users/dao/user.entity.js';
import { CreateRequestDto } from './dto/create-request.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';
import { AssignRequestDto } from './dto/assign-request.dto.js';
import { ListRequestsQueryDto } from './dto/list-requests-query.dto.js';
import { RequestsService, STALE_VERSION_MESSAGE } from './requests.service.js';

const requestExample = {
  id: 1,
  description: 'Follow up on the proposal',
  status: 'PENDING',
  version: 1,
  advisor: { id: '3', name: 'Advisor One', role: 'advisor' },
  client: { id: 1, name: 'Acme Ltd' },
  createdAt: '2026-10-13T10:00:00.000Z',
  updatedAt: '2026-10-13T10:00:00.000Z',
};

const errorExample = (statusCode: number, message: string, path: string) => ({
  schema: {
    example: {
      success: false,
      statusCode,
      message,
      timestamp: '2026-10-13T11:00:00.000Z',
      path,
    },
  },
});

@ApiTags('Requests')
@ApiSecurity('api-key')
@ApiUnauthorizedResponse({
  description: 'Missing or invalid API key or user',
  ...errorExample(401, 'Missing or invalid API key', '/requests'),
})
@ApiHeader({
  name: 'x-user',
  description: 'Existing user ID (1 admin, 2 supervisor, 3/4 advisors)',
  required: true,
  example: '3',
})
@Controller('requests')
@UseGuards(ApiKeyGuard, UserGuard, RolesGuard)
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a commercial request',
    description:
      'Status starts as PENDING. Advisors are assigned to themselves; requests created by admins or supervisors stay unassigned. Records a CREATION event (and an ASSIGNMENT event for advisors).',
  })
  @ApiCreatedResponse({
    description: 'Request created',
    schema: { example: { success: true, data: requestExample } },
  })
  @ApiBadRequestResponse({
    description: 'Invalid or blank fields, or unknown properties',
  })
  @ApiNotFoundResponse({ description: 'Client not found' })
  create(@Body() dto: CreateRequestDto, @CurrentUser() user: User) {
    return this.requests.create(dto, user);
  }

  @Get()
  @ApiOperation({
    summary: 'List requests with filters and pagination',
    description:
      'Advisors only see their own requests, even if they send another advisor filter. Admins and supervisors see all.',
  })
  @ApiOkResponse({
    description: 'Page of visible requests',
    schema: {
      example: {
        success: true,
        data: {
          items: [requestExample],
          pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'Invalid filters, page/limit out of range, or "from" later than "to"',
  })
  list(@Query() query: ListRequestsQueryDto, @CurrentUser() user: User) {
    return this.requests.list(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a request by ID' })
  @ApiOkResponse({
    description: 'Request returned successfully',
    schema: { example: { success: true, data: requestExample } },
  })
  @ApiNotFoundResponse({ description: 'Request not found or not accessible' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.requests.findOne(id, user);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Change request status with optimistic concurrency',
    description:
      'Allowed transitions: PENDING → IN_PROGRESS → RESOLVED. expectedVersion must match the current version; on success the version grows by 1 and a STATUS event is recorded in the same transaction.',
  })
  @ApiOkResponse({
    description: 'Status updated successfully',
    schema: {
      example: {
        success: true,
        data: { ...requestExample, status: 'IN_PROGRESS', version: 2 },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid status transition or body' })
  @ApiNotFoundResponse({ description: 'Request not found or not accessible' })
  @ApiConflictResponse({
    description: 'expectedVersion is outdated',
    ...errorExample(409, STALE_VERSION_MESSAGE, '/requests/1/status'),
  })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: User,
  ) {
    return this.requests.updateStatus(id, dto, user);
  }

  @Patch(':id/assignment')
  @Roles('admin', 'supervisor')
  @ApiOperation({
    summary: 'Assign or reassign a request to an advisor',
    description:
      'Only admins and supervisors. The target must be an active advisor. The status does not change; an ASSIGNMENT event is recorded in the same transaction.',
  })
  @ApiOkResponse({
    description: 'Request assigned',
    schema: {
      example: { success: true, data: { ...requestExample, version: 2 } },
    },
  })
  @ApiBadRequestResponse({
    description:
      'Invalid body, or the user does not exist or is not an active advisor',
  })
  @ApiForbiddenResponse({
    description: 'Only admins and supervisors can assign',
  })
  @ApiNotFoundResponse({ description: 'Request not found' })
  @ApiConflictResponse({
    description: 'The request is RESOLVED or was modified at the same time',
    ...errorExample(
      409,
      'A RESOLVED request cannot be reassigned',
      '/requests/1/assignment',
    ),
  })
  assign(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignRequestDto,
    @CurrentUser() user: User,
  ) {
    return this.requests.assign(id, dto, user);
  }

  @Get(':id/history')
  @ApiOperation({
    summary: 'Get the audit history of a request (read only)',
    description:
      'Admins and supervisors can read any history. Advisors only the history of requests currently assigned to them.',
  })
  @ApiOkResponse({
    description: 'Events ordered from oldest to newest',
    schema: {
      example: {
        success: true,
        data: [
          {
            id: 1,
            requestId: 1,
            eventType: 'CREATION',
            previousValue: null,
            newValue: 'PENDING',
            actor: { id: '2', name: 'Sales Supervisor', role: 'supervisor' },
            eventDate: '2026-10-13T10:00:00.000Z',
          },
        ],
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Request not found or not accessible' })
  findHistory(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    return this.requests.findHistory(id, user);
  }
}
