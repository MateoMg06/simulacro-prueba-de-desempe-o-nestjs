import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
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
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../users/dao/user.entity.js';
import { CreateRequestDto } from './dto/create-request.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';
import { RequestsService } from './requests.service.js';

@ApiTags('Requests')
@ApiSecurity('api-key')
@ApiUnauthorizedResponse({ description: 'Missing or invalid API key or user' })
@ApiForbiddenResponse({
  description: 'The current user cannot access this request',
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
      'Advisors are always assigned to themselves. Admins and supervisors may set advisorId; otherwise the first active advisor is selected. Status starts as PENDING.',
  })
  @ApiCreatedResponse({
    description: 'Request created',
    schema: {
      example: {
        success: true,
        data: {
          id: 1,
          client: { id: 1, name: 'Acme Ltd' },
          advisor: { id: '3', name: 'Advisor One' },
          description: 'Follow up on the proposal',
          status: 'PENDING',
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid request body' })
  create(@Body() dto: CreateRequestDto, @CurrentUser() user: User) {
    return this.requests.create(dto, user);
  }
  @Get()
  @ApiOkResponse({ description: 'Visible requests returned successfully' })
  @ApiOperation({
    summary: 'List requests allowed for the current user',
    description:
      'Advisors only see their own requests. Supervisors and admins see all.',
  })
  list(@CurrentUser() user: User) {
    return this.requests.list(user);
  }
  @Get(':id')
  @ApiOperation({ summary: 'Get a request by ID' })
  @ApiOkResponse({ description: 'Request returned successfully' })
  @ApiNotFoundResponse({ description: 'Request not found or not accessible' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.requests.findOne(id, user);
  }
  @Patch(':id/status')
  @ApiOkResponse({ description: 'Status updated successfully' })
  @ApiOperation({
    summary: 'Change request status',
    description: 'Allowed transitions: PENDING → IN_PROGRESS → RESOLVED.',
  })
  @ApiBadRequestResponse({ description: 'Invalid status transition or body' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: User,
  ) {
    return this.requests.updateStatus(id, dto.status, user);
  }
}
