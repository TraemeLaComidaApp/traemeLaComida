import { PartialType } from '@nestjs/swagger';
import { CreateConfiguracionLocalDto } from './create-configuracion-local.dto';

export class UpdateConfiguracionLocalDto extends PartialType(CreateConfiguracionLocalDto) {}
