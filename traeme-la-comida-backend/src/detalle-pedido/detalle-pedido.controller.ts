import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { DetallePedidoService } from './detalle-pedido.service';
import { CreateDetallePedidoDto } from './dto/create-detalle-pedido.dto';
import { UpdateDetallePedidoDto } from './dto/update-detalle-pedido.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('DetallePedido')
@Controller('detalle-pedido')
export class DetallePedidoController {
  constructor(private readonly service: DetallePedidoService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un registro en DetallePedido' })
  create(@Body() createDto: CreateDetallePedidoDto) {
    return this.service.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los registros en DetallePedido' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un detalle por id' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(+id);
  }

  @Get('pedido/:idPedido')
  @ApiOperation({ summary: 'Obtener detalles por id de pedido' })
  findByPedido(@Param('idPedido') idPedido: string) {
    return this.service.findByPedido(+idPedido);
  }

  @Get('producto/:idProducto')
  @ApiOperation({ summary: 'Obtener detalles por id de producto' })
  findByProducto(@Param('idProducto') idProducto: string) {
    return this.service.findByProducto(+idProducto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un detalle de pedido' })
  update(@Param('id') id: string, @Body() updateDto: UpdateDetallePedidoDto) {
    return this.service.update(+id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un detalle de pedido' })
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }
}
