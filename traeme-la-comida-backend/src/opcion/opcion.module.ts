import { Module } from '@nestjs/common';
import { OpcionController } from './opcion.controller';
import { OpcionService } from './opcion.service';

@Module({
  controllers: [OpcionController],
  providers: [OpcionService]
})
export class OpcionModule {}
