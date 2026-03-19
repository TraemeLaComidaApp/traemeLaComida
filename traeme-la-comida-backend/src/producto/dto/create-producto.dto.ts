import { IsOptional, IsNumber, IsNotEmpty, IsString, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';


export class CreateProductoDto {
  @ApiProperty({ required: true, type: () => Number })
  @IsNotEmpty()
  @IsNumber()
  id_categoria_producto: number;

  @ApiProperty({ required: true, type: () => String })
  @IsNotEmpty()
  @IsString()
  nombre: string;

  @ApiProperty({ required: false, type: () => String })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({ required: true, type: () => Number })
  @IsNotEmpty()
  @IsNumber()
  precio: number;

  @ApiProperty({ required: false, type: () => String })
  @IsOptional()
  @IsString()
  imagen_url?: string;

  @ApiProperty({ required: false, type: () => Boolean })
  @IsOptional()
  @IsBoolean()
  disponible?: boolean;

  @ApiProperty({ required: false, type: () => Number })
  @IsOptional()
  @IsNumber()
  orden?: number;
}
