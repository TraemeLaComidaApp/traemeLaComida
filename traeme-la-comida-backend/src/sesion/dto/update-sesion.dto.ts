import { PartialType } from '@nestjs/swagger';
import { CreateSesionDto } from './create-sesion.dto';

export class UpdateSesionDto extends PartialType(CreateSesionDto) {}
