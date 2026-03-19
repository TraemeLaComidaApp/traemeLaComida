import { IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';


export class CreateConfiguracionLocalDto {
  @ApiProperty({ required: true, type: () => String })
  @IsNotEmpty()
  @IsString()
  nombre_local: string;

  @ApiProperty({ required: false, type: () => String })
  @IsOptional()
  @IsString()
  logo_url?: string;

  @ApiProperty({ required: false, type: () => String })
  @IsOptional()
  @IsString()
  color_primario?: string;

  @ApiProperty({ required: false, type: () => String })
  @IsOptional()
  @IsString()
  link_resenas_google?: string;
}
