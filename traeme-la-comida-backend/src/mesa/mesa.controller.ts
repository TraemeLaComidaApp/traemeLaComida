import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { MesaService } from './mesa.service';
import { CreateMesaDto } from './dto/create-mesa.dto';
import { UpdateMesaDto } from './dto/update-mesa.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Mesa')
@Controller('mesa')
export class MesaController {
  constructor(private readonly service: MesaService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un registro en Mesa' })
  create(@Body() createDto: CreateMesaDto) {
    return this.service.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los registros en Mesa' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un registro en Mesa por su id' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un registro en Mesa' })
  update(@Param('id') id: string, @Body() updateDto: UpdateMesaDto) {
    return this.service.update(+id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un registro en Mesa' })
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }
}
