import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { NormalizeText } from '../../common/transforms/normalize-text.js';
import { IsOptionalNotNull } from '../../common/validators/is-optional-not-null.js';
export class CreateClientDto {
  @ApiProperty({ example: 'Acme Ltd' })
  @NormalizeText()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;
  @ApiProperty({ example: 'contact@acme.example' })
  @NormalizeText()
  @IsEmail()
  @MaxLength(180)
  email: string;
  @ApiProperty({ example: '+1-555-0100' })
  @NormalizeText()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone: string;
  @ApiPropertyOptional({
    example: 'TAX-12345',
    description: 'Optional, but null is not accepted',
  })
  @IsOptionalNotNull()
  @NormalizeText()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  document?: string;
}
