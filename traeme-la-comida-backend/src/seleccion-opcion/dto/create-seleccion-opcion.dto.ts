import { IsOptional, IsNumber, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';


export class CreateSeleccionOpcionDto {
  @ApiProperty({ required: true, type: () => Number })
  @IsNotEmpty()
  @IsNumber()
  id_detalle_pedido: number;

  @ApiProperty({ required: true, type: () => Number })
  @IsNotEmpty()
  @IsNumber()
  id_opcion: number;

  @ApiProperty({ required: false, type: () => Number })
  @IsOptional()
  @IsNumber()
  precio_extra_aplicado?: number;
}
