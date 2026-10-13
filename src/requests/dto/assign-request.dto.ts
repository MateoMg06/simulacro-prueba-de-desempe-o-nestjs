import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { NormalizeText } from '../../common/transforms/normalize-text.js';
export class AssignRequestDto {
  @ApiProperty({
    example: '4',
    description: 'ID of an existing active user with the advisor role',
  })
  @NormalizeText()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  advisorId: string;
}
