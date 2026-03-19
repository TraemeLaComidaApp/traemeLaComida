import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { PagoService } from './pago.service';
import { CreatePagoDto } from './dto/create-pago.dto';
import { UpdatePagoDto } from './dto/update-pago.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Pago')
@Controller('pago')
export class PagoController {
  constructor(private readonly service: PagoService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un registro en Pago' })
  create(@Body() createDto: CreatePagoDto) {
    return this.service.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los registros en Pago' })
  findAll() {
    return this.service.findAll();
  }

  @Get('sesion/:idSesion')
  @ApiOperation({ summary: 'Obtener pagos por id de sesion' })
  findBySesion(@Param('idSesion') idSesion: string) {
    return this.service.findBySesion(+idSesion);
  }

  @Get('pedido/:idPedido')
  @ApiOperation({ summary: 'Obtener pagos por id de pedido' })
  findByPedido(@Param('idPedido') idPedido: string) {
    return this.service.findByPedido(+idPedido);
  }

  @Patch(':idSesion/:idPedido')
  @ApiOperation({ summary: 'Actualizar un pago' })
  update(
    @Param('idSesion') idSesion: string,
    @Param('idPedido') idPedido: string,
    @Body() updateDto: UpdatePagoDto,
  ) {
    return this.service.update(+idSesion, +idPedido, updateDto);
  }

  @Delete(':idSesion/:idPedido')
  @ApiOperation({ summary: 'Eliminar un pago' })
  remove(@Param('idSesion') idSesion: string, @Param('idPedido') idPedido: string) {
    return this.service.remove(+idSesion, +idPedido);
  }
}
