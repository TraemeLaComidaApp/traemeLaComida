import { Module } from '@nestjs/common';
import { CategoriaProductoController } from './categoria-producto.controller';
import { CategoriaProductoService } from './categoria-producto.service';

@Module({
  controllers: [CategoriaProductoController],
  providers: [CategoriaProductoService]
})
export class CategoriaProductoModule {}
