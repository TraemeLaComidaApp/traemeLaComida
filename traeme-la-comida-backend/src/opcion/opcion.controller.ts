import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { OpcionService } from './opcion.service';
import { CreateOpcionDto } from './dto/create-opcion.dto';
import { UpdateOpcionDto } from './dto/update-opcion.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Opcion')
@Controller('opcion')
export class OpcionController {
  constructor(private readonly service: OpcionService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un registro en Opcion' })
  create(@Body() createDto: CreateOpcionDto) {
    return this.service.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los registros en Opcion' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un registro en Opcion por su id' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un registro en Opcion' })
  update(@Param('id') id: string, @Body() updateDto: UpdateOpcionDto) {
    return this.service.update(+id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un registro en Opcion' })
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }
}
