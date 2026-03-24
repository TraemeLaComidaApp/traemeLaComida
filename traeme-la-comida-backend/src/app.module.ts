import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { ConfiguracionLocalModule } from './configuracion-local/configuracion-local.module';
import { SalaModule } from './sala/sala.module';
import { MesaModule } from './mesa/mesa.module';

import { CategoriaProductoModule } from './categoria-producto/categoria-producto.module';
import { ProductoModule } from './producto/producto.module';
import { CategoriaOpcionModule } from './categoria-opcion/categoria-opcion.module';
import { ProductoCategoriaOpcionModule } from './producto-categoria-opcion/producto-categoria-opcion.module';
import { OpcionModule } from './opcion/opcion.module';
import { PedidoModule } from './pedido/pedido.module';
import { DetallePedidoModule } from './detalle-pedido/detalle-pedido.module';
import { SeleccionOpcionModule } from './seleccion-opcion/seleccion-opcion.module';
import { PagoModule } from './pago/pago.module';
import { UsuarioModule } from './usuario/usuario.module';
import { SupabaseModule } from './supabase/supabase.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ConfiguracionLocalModule, SalaModule, MesaModule, CategoriaProductoModule, ProductoModule, CategoriaOpcionModule, ProductoCategoriaOpcionModule, OpcionModule, PedidoModule, DetallePedidoModule, SeleccionOpcionModule, PagoModule, UsuarioModule, SupabaseModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
