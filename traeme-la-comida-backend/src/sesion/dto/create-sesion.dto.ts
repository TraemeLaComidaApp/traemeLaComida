import { IsOptional, IsNumber, IsNotEmpty, IsBoolean, IsString, IsDate } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateSesionDto {
  @ApiProperty({ required: true, type: () => Number })
  @IsNotEmpty()
  @IsNumber()
  id_mesa: number;

  @ApiProperty({ required: false, type: () => String, description: 'Estado de la sesión (ej: activa, Pedido_realizado, etc.)' })
  @IsOptional()
  @IsString()
  estado?: string;

  @ApiProperty({ required: false, type: () => Date })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  fecha_inicio?: Date;

  @ApiProperty({ required: false, type: () => Date })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  fecha_fin?: Date;
}
