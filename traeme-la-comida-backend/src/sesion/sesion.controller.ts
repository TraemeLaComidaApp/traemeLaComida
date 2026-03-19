import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { SesionService } from './sesion.service';
import { CreateSesionDto } from './dto/create-sesion.dto';
import { UpdateSesionDto } from './dto/update-sesion.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Sesion')
@Controller('sesion')
export class SesionController {
  constructor(private readonly service: SesionService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un registro en Sesion' })
  create(@Body() createDto: CreateSesionDto) {
    return this.service.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los registros en Sesion' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un registro en Sesion por su id' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un registro en Sesion' })
  update(@Param('id') id: string, @Body() updateDto: UpdateSesionDto) {
    return this.service.update(+id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un registro en Sesion' })
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }
}
