import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { RequestStatus } from '../dao/request-status.enum.js';
import { NormalizeText } from '../../common/transforms/normalize-text.js';
import { IsOptionalNotNull } from '../../common/validators/is-optional-not-null.js';

export class ListRequestsQueryDto {
  @ApiPropertyOptional({ enum: RequestStatus })
  @IsOptionalNotNull()
  @IsEnum(RequestStatus)
  status?: RequestStatus;

  @ApiPropertyOptional({
    example: '3',
    description:
      'Assigned advisor ID. For advisors it is combined with their own ID, so it cannot widen access.',
  })
  @IsOptionalNotNull()
  @IsString()
  @IsNotEmpty()
  advisor?: string;

  @ApiPropertyOptional({
    example: 'acme',
    description: 'Partial, case-insensitive client name',
  })
  @IsOptionalNotNull()
  @NormalizeText()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  client?: string;

  @ApiPropertyOptional({
    example: '2026-10-01T00:00:00Z',
    description: 'Created at or after this ISO 8601 date',
  })
  @IsOptionalNotNull()
  @IsISO8601({ strict: true })
  from?: string;

  @ApiPropertyOptional({
    example: '2026-10-31T23:59:59Z',
    description: 'Created at or before this ISO 8601 date',
  })
  @IsOptionalNotNull()
  @IsISO8601({ strict: true })
  to?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptionalNotNull()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptionalNotNull()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;
}
