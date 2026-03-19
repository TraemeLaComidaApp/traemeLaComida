import { IsOptional, IsNumber, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';


export class CreateOpcionDto {
  @ApiProperty({ required: true, type: () => Number })
  @IsNotEmpty()
  @IsNumber()
  id_categoria_opcion: number;

  @ApiProperty({ required: true, type: () => String })
  @IsNotEmpty()
  @IsString()
  nombre: string;

  @ApiProperty({ required: false, type: () => Number })
  @IsOptional()
  @IsNumber()
  precio_extra?: number;

}
