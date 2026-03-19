import { IsOptional, IsNumber, IsNotEmpty, IsString, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';


export class CreateDetallePedidoDto {
  @ApiProperty({ required: true, type: () => Number })
  @IsNotEmpty()
  @IsNumber()
  id_pedido: number;

  @ApiProperty({ required: true, type: () => Number })
  @IsNotEmpty()
  @IsNumber()
  id_producto: number;

  @ApiProperty({ required: true, type: () => Number })
  @IsNotEmpty()
  @IsNumber()
  cantidad: number;

  @ApiProperty({ required: true, type: () => Number })
  @IsNotEmpty()
  @IsNumber()
  precio_unitario: number;

  @ApiProperty({ required: false, type: () => Boolean, default: false })
  @IsOptional()
  @IsBoolean()
  esta_listo?: boolean;

  @ApiProperty({ required: false, type: () => String })
  @IsOptional()
  @IsString()
  notas?: string;
}
