import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateChecklistFotoDto {
  @ApiProperty({ description: 'Foto em base64 ou URL', example: 'data:image/png;base64,iVBORw0K...' })
  @IsString()
  foto!: string;
}
