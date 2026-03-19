import { Module } from '@nestjs/common';
import { CategoriaOpcionController } from './categoria-opcion.controller';
import { CategoriaOpcionService } from './categoria-opcion.service';

@Module({
  controllers: [CategoriaOpcionController],
  providers: [CategoriaOpcionService]
})
export class CategoriaOpcionModule {}
