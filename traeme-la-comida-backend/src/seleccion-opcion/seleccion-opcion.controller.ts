import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { SeleccionOpcionService } from './seleccion-opcion.service';
import { CreateSeleccionOpcionDto } from './dto/create-seleccion-opcion.dto';
import { UpdateSeleccionOpcionDto } from './dto/update-seleccion-opcion.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('SeleccionOpcion')
@Controller('seleccion-opcion')
export class SeleccionOpcionController {
  constructor(private readonly service: SeleccionOpcionService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un registro en SeleccionOpcion' })
  create(@Body() createDto: CreateSeleccionOpcionDto) {
    return this.service.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los registros en SeleccionOpcion' })
  findAll() {
    return this.service.findAll();
  }

  @Get('detalle-pedido/:idDetallePedido')
  @ApiOperation({ summary: 'Obtener selecciones por id de detalle de pedido' })
  findByDetallePedido(@Param('idDetallePedido') idDetallePedido: string) {
    return this.service.findByDetallePedido(+idDetallePedido);
  }

  @Get('opcion/:idOpcion')
  @ApiOperation({ summary: 'Obtener selecciones por id de opcion' })
  findByOpcion(@Param('idOpcion') idOpcion: string) {
    return this.service.findByOpcion(+idOpcion);
  }

  @Patch(':idDetallePedido/:idOpcion')
  @ApiOperation({ summary: 'Actualizar una seleccion de opcion' })
  update(
    @Param('idDetallePedido') idDetallePedido: string,
    @Param('idOpcion') idOpcion: string,
    @Body() updateDto: UpdateSeleccionOpcionDto,
  ) {
    return this.service.update(+idDetallePedido, +idOpcion, updateDto);
  }

  @Delete(':idDetallePedido/:idOpcion')
  @ApiOperation({ summary: 'Eliminar una seleccion de opcion' })
  remove(
    @Param('idDetallePedido') idDetallePedido: string,
    @Param('idOpcion') idOpcion: string,
  ) {
    return this.service.remove(+idDetallePedido, +idOpcion);
  }
}
