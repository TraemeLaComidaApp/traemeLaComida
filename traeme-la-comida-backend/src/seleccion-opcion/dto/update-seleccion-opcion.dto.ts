import { PartialType } from '@nestjs/swagger';
import { CreateSeleccionOpcionDto } from './create-seleccion-opcion.dto';

export class UpdateSeleccionOpcionDto extends PartialType(CreateSeleccionOpcionDto) {}
