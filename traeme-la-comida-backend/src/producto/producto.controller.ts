import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ProductoService } from './producto.service';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Producto')
@Controller('producto')
export class ProductoController {
  constructor(private readonly service: ProductoService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un registro en Producto' })
  create(@Body() createDto: CreateProductoDto) {
    return this.service.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los registros en Producto' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un registro en Producto por su id' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un registro en Producto' })
  update(@Param('id') id: string, @Body() updateDto: UpdateProductoDto) {
    return this.service.update(+id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un registro en Producto' })
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }
}
