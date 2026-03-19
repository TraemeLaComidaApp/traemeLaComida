import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CategoriaProductoService } from './categoria-producto.service';
import { CreateCategoriaProductoDto } from './dto/create-categoria-producto.dto';
import { UpdateCategoriaProductoDto } from './dto/update-categoria-producto.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('CategoriaProducto')
@Controller('categoria-producto')
export class CategoriaProductoController {
  constructor(private readonly service: CategoriaProductoService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un registro en CategoriaProducto' })
  create(@Body() createDto: CreateCategoriaProductoDto) {
    return this.service.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los registros en CategoriaProducto' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un registro en CategoriaProducto por su id' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un registro en CategoriaProducto' })
  update(@Param('id') id: string, @Body() updateDto: UpdateCategoriaProductoDto) {
    return this.service.update(+id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un registro en CategoriaProducto' })
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }
}
