import { IsOptional, IsNumber, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';


export class CreateMesaDto {
  @ApiProperty({ required: true, type: () => Number })
  @IsNotEmpty()
  @IsNumber()
  id_sala: number;

  @ApiProperty({ required: true, type: () => String })
  @IsNotEmpty()
  @IsString()
  tipo: string;

  @ApiProperty({ required: true, type: () => String })
  @IsNotEmpty()
  @IsString()
  numero: string;

  @ApiProperty({ required: false, type: () => String })
  @IsOptional()
  @IsString()
  link_qr?: string;

  @ApiProperty({ required: false, type: () => Number })
  @IsOptional()
  @IsNumber()
  pos_x?: number;

  @ApiProperty({ required: false, type: () => Number })
  @IsOptional()
  @IsNumber()
  pos_y?: number;

  @ApiProperty({ required: false, type: () => Number })
  @IsOptional()
  @IsNumber()
  ancho?: number;

  @ApiProperty({ required: false, type: () => Number })
  @IsOptional()
  @IsNumber()
  alto?: number;

  @ApiProperty({ required: false, type: () => Number })
  @IsOptional()
  @IsNumber()
  rotacion?: number;
}
