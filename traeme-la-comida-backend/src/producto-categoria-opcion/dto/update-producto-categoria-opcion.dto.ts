import { PartialType } from '@nestjs/swagger';
import { CreateProductoCategoriaOpcionDto } from './create-producto-categoria-opcion.dto';

export class UpdateProductoCategoriaOpcionDto extends PartialType(CreateProductoCategoriaOpcionDto) {}
