import { IsOptional, IsNumber, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';


export class CreateProductoCategoriaOpcionDto {
  @ApiProperty({ required: true, type: () => Number })
  @IsNotEmpty()
  @IsNumber()
  id_producto: number;

  @ApiProperty({ required: true, type: () => Number })
  @IsNotEmpty()
  @IsNumber()
  id_categoria_opcion: number;

  @ApiProperty({ required: false, type: () => Number })
  @IsOptional()
  @IsNumber()
  min_selecciones?: number;

  @ApiProperty({ required: false, type: () => Number })
  @IsOptional()
  @IsNumber()
  max_selecciones?: number;

  @ApiProperty({ required: false, type: () => Number })
  @IsOptional()
  @IsNumber()
  orden?: number;
}
