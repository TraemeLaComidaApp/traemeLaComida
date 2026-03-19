import { PartialType } from '@nestjs/swagger';
import { CreateCategoriaOpcionDto } from './create-categoria-opcion.dto';

export class UpdateCategoriaOpcionDto extends PartialType(CreateCategoriaOpcionDto) {}
