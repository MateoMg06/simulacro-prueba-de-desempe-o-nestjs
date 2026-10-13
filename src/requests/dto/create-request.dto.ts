import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';
import { NormalizeText } from '../../common/transforms/normalize-text.js';

// Status, advisor, version and dates are managed by the system and cannot be sent.
export class CreateRequestDto {
  @ApiProperty({ example: 1, description: 'Existing client ID' })
  @IsInt()
  @Min(1)
  clientId: number;
  @ApiProperty({
    example: 'Follow up about the annual service proposal.',
    description: 'Required. Extra spaces are removed; blank text is rejected.',
  })
  @NormalizeText()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description: string;
}
