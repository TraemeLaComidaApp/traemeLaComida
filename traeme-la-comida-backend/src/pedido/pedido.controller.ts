import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { PedidoService } from './pedido.service';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { UpdatePedidoDto } from './dto/update-pedido.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Pedido')
@Controller('pedido')
export class PedidoController {
  constructor(private readonly service: PedidoService) { }

  @Post()
  @ApiOperation({ summary: 'Crear un registro en Pedido' })
  create(@Body() createDto: CreatePedidoDto) {
    return this.service.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los registros en Pedido' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un registro en Pedido por su id' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un registro en Pedido' })
  update(@Param('id') id: string, @Body() updateDto: UpdatePedidoDto) {
    return this.service.update(+id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un registro en Pedido' })
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }
}
