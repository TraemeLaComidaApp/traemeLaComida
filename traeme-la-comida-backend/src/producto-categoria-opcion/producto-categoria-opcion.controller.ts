import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ProductoCategoriaOpcionService } from './producto-categoria-opcion.service';
import { CreateProductoCategoriaOpcionDto } from './dto/create-producto-categoria-opcion.dto';
import { UpdateProductoCategoriaOpcionDto } from './dto/update-producto-categoria-opcion.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('ProductoCategoriaOpcion')
@Controller('producto-categoria-opcion')
export class ProductoCategoriaOpcionController {
  constructor(private readonly service: ProductoCategoriaOpcionService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un registro en ProductoCategoriaOpcion' })
  create(@Body() createDto: CreateProductoCategoriaOpcionDto) {
    return this.service.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los registros en ProductoCategoriaOpcion' })
  findAll() {
    return this.service.findAll();
  }

  @Get('producto/:idProducto')
  @ApiOperation({ summary: 'Obtener registros por id de producto' })
  findByProducto(@Param('idProducto') idProducto: string) {
    return this.service.findByProducto(+idProducto);
  }

  @Get('categoria-opcion/:idCategoriaOpcion')
  @ApiOperation({ summary: 'Obtener registros por id de categoria-opcion' })
  findByCategoriaOpcion(@Param('idCategoriaOpcion') idCategoriaOpcion: string) {
    return this.service.findByCategoriaOpcion(+idCategoriaOpcion);
  }

  @Patch(':idProducto/:idCategoriaOpcion')
  @ApiOperation({ summary: 'Actualizar un registro en ProductoCategoriaOpcion' })
  update(
    @Param('idProducto') idProducto: string,
    @Param('idCategoriaOpcion') idCategoriaOpcion: string,
    @Body() updateDto: UpdateProductoCategoriaOpcionDto,
  ) {
    return this.service.update(+idProducto, +idCategoriaOpcion, updateDto);
  }

  @Delete(':idProducto/:idCategoriaOpcion')
  @ApiOperation({ summary: 'Eliminar un registro en ProductoCategoriaOpcion' })
  remove(
    @Param('idProducto') idProducto: string,
    @Param('idCategoriaOpcion') idCategoriaOpcion: string,
  ) {
    return this.service.remove(+idProducto, +idCategoriaOpcion);
  }
}
