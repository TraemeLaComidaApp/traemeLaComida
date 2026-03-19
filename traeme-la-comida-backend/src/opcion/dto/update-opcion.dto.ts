import { PartialType } from '@nestjs/swagger';
import { CreateOpcionDto } from './create-opcion.dto';

export class UpdateOpcionDto extends PartialType(CreateOpcionDto) {}
