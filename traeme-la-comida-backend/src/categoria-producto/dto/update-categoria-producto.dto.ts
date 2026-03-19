import { PartialType } from '@nestjs/swagger';
import { CreateCategoriaProductoDto } from './create-categoria-producto.dto';

export class UpdateCategoriaProductoDto extends PartialType(CreateCategoriaProductoDto) {}
