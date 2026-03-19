import { IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';


export class CreateCategoriaOpcionDto {
  @ApiProperty({ required: true, type: () => String })
  @IsNotEmpty()
  @IsString()
  nombre: string;
}
