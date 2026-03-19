import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { SalaService } from './sala.service';
import { CreateSalaDto } from './dto/create-sala.dto';
import { UpdateSalaDto } from './dto/update-sala.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Sala')
@Controller('sala')
export class SalaController {
  constructor(private readonly service: SalaService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un registro en Sala' })
  create(@Body() createDto: CreateSalaDto) {
    return this.service.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los registros en Sala' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un registro en Sala por su id' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un registro en Sala' })
  update(@Param('id') id: string, @Body() updateDto: UpdateSalaDto) {
    return this.service.update(+id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un registro en Sala' })
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }
}
