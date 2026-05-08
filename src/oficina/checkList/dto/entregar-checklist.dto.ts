import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class EntregarChecklistDto {
  @ApiProperty({
    description: 'Assinatura do cliente para retirada do veiculo (data URL/base64).',
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2_000_000)
  assinaturaRetiradaBase64!: string;
}
