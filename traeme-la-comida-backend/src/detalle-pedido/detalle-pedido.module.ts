import { Module } from '@nestjs/common';
import { DetallePedidoController } from './detalle-pedido.controller';
import { DetallePedidoService } from './detalle-pedido.service';

@Module({
  controllers: [DetallePedidoController],
  providers: [DetallePedidoService]
})
export class DetallePedidoModule {}
