import { Module } from '@nestjs/common';
import { MesaController } from './mesa.controller';
import { MesaService } from './mesa.service';

@Module({
  controllers: [MesaController],
  providers: [MesaService]
})
export class MesaModule {}
