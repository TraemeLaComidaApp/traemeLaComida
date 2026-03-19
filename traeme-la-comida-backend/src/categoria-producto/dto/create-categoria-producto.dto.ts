import { IsOptional, IsString, IsNotEmpty, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';


export class CreateCategoriaProductoDto {
  @ApiProperty({ required: true, type: () => String })
  @IsNotEmpty()
  @IsString()
  nombre: string;

  @ApiProperty({ required: false, type: () => Number })
  @IsOptional()
  @IsNumber()
  orden?: number;
}
