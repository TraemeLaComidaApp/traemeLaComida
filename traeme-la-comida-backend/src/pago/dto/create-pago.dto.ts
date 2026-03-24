import { IsOptional, IsNumber, IsNotEmpty, IsString, IsBoolean, IsDate } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreatePagoDto {

  @ApiProperty({ required: false, type: () => Number })
  @IsOptional()
  @IsNumber()
  id_pedido?: number;

  @ApiProperty({ required: true, type: () => Number })
  @IsNotEmpty()
  @IsNumber()
  monto_pagado: number;

  @ApiProperty({ required: true, type: () => String })
  @IsNotEmpty()
  @IsString()
  metodo: string;


  @ApiProperty({ required: false, type: () => Date })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  fecha_pago?: Date;
}
