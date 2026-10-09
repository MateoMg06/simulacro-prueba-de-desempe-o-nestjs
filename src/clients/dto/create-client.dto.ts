import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
export class CreateClientDto {
  @ApiProperty({ example: 'Acme Ltd' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;
  @ApiPropertyOptional({ example: 'contact@acme.example' })
  @IsOptional()
  @IsEmail()
  email?: string;
  @ApiPropertyOptional({ example: '+1-555-0100' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
  @ApiPropertyOptional({ example: 'TAX-12345' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  document?: string;
}
