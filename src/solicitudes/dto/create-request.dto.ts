import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
export class CreateRequestDto {
  @ApiProperty({ example: 1, description: 'Existing client ID' })
  @IsInt()
  @Min(1)
  clientId: number;
  @ApiProperty({ example: 'Follow up about the annual service proposal.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description: string;

  @ApiPropertyOptional({
    example: '4',
    description:
      'Optional advisor assignment for admin or supervisor. Defaults to the first active advisor. Advisors are always assigned to themselves.',
  })
  @IsOptional()
  @IsString()
  advisorId?: string;
}
