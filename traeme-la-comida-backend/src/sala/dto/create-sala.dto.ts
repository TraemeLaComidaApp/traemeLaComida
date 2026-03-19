import { IsOptional, IsString, IsNotEmpty, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';


export class CreateSalaDto {
  @ApiProperty({ required: true, type: () => String })
  @IsNotEmpty()
  @IsString()
  nombre: string;

  @ApiProperty({ required: false, type: () => Number })
  @IsOptional()
  @IsNumber()
  ancho?: number;

  @ApiProperty({ required: false, type: () => Number })
  @IsOptional()
  @IsNumber()
  alto?: number;
}
