import { Module } from '@nestjs/common';
import { SeleccionOpcionController } from './seleccion-opcion.controller';
import { SeleccionOpcionService } from './seleccion-opcion.service';

@Module({
  controllers: [SeleccionOpcionController],
  providers: [SeleccionOpcionService]
})
export class SeleccionOpcionModule {}
