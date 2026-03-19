import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CategoriaOpcionService } from './categoria-opcion.service';
import { CreateCategoriaOpcionDto } from './dto/create-categoria-opcion.dto';
import { UpdateCategoriaOpcionDto } from './dto/update-categoria-opcion.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('CategoriaOpcion')
@Controller('categoria-opcion')
export class CategoriaOpcionController {
  constructor(private readonly service: CategoriaOpcionService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un registro en CategoriaOpcion' })
  create(@Body() createDto: CreateCategoriaOpcionDto) {
    return this.service.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los registros en CategoriaOpcion' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un registro en CategoriaOpcion por su id' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un registro en CategoriaOpcion' })
  update(@Param('id') id: string, @Body() updateDto: UpdateCategoriaOpcionDto) {
    return this.service.update(+id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un registro en CategoriaOpcion' })
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }
}
