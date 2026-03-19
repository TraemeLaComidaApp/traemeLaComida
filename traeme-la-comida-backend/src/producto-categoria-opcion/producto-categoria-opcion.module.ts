import { Module } from '@nestjs/common';
import { ProductoCategoriaOpcionController } from './producto-categoria-opcion.controller';
import { ProductoCategoriaOpcionService } from './producto-categoria-opcion.service';

@Module({
  controllers: [ProductoCategoriaOpcionController],
  providers: [ProductoCategoriaOpcionService]
})
export class ProductoCategoriaOpcionModule {}
