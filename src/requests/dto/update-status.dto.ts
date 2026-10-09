import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { RequestStatus } from '../dao/request-status.enum.js';
export class UpdateStatusDto {
  @ApiProperty({ enum: RequestStatus, example: RequestStatus.IN_PROGRESS })
  @IsEnum(RequestStatus)
  status: RequestStatus;
}
