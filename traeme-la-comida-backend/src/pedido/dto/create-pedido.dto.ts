import { IsOptional, IsNumber, IsBoolean, IsString, IsDate } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreatePedidoDto {
  @ApiProperty({ required: false, type: () => Number })
  @IsOptional()
  @IsNumber()
  id_sesion?: number;

  @ApiProperty({ required: false, type: () => Boolean })
  @IsOptional()
  @IsBoolean()
  es_barra?: boolean;

  @ApiProperty({ required: false, type: () => String })
  @IsOptional()
  @IsString()
  estado?: string;

  @ApiProperty({ required: false, type: () => Date })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  creado_at?: Date;
}
