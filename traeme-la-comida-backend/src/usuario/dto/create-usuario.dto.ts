import { IsOptional, IsString, IsNotEmpty, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUsuarioDto {
  @ApiProperty({ required: true, type: () => String })
  @IsNotEmpty()
  @IsString()
  usuario: string;

  @ApiProperty({ required: true, type: () => String })
  @IsNotEmpty()
  @IsString()
  password: string;

  @ApiProperty({ required: false, type: () => String })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false, type: () => String, example: 'camarero', default: 'camarero' })
  @IsOptional()
  @IsString()
  rol?: string;
}
