import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, Min } from 'class-validator';
import { RequestStatus } from '../dao/request-status.enum.js';
export class UpdateStatusDto {
  @ApiProperty({ enum: RequestStatus, example: RequestStatus.IN_PROGRESS })
  @IsEnum(RequestStatus)
  status: RequestStatus;
  @ApiProperty({
    example: 1,
    description:
      'Current version of the request (spec: versionEsperada). A different value returns 409.',
  })
  @IsInt()
  @Min(1)
  expectedVersion: number;
}
