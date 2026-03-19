import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ConfiguracionLocalService } from './configuracion-local.service';
import { CreateConfiguracionLocalDto } from './dto/create-configuracion-local.dto';
import { UpdateConfiguracionLocalDto } from './dto/update-configuracion-local.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('ConfiguracionLocal')
@Controller('configuracion-local')
export class ConfiguracionLocalController {
  constructor(private readonly service: ConfiguracionLocalService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un registro en ConfiguracionLocal' })
  create(@Body() createDto: CreateConfiguracionLocalDto) {
    return this.service.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los registros en ConfiguracionLocal' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un registro en ConfiguracionLocal por su id' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un registro en ConfiguracionLocal' })
  update(@Param('id') id: string, @Body() updateDto: UpdateConfiguracionLocalDto) {
    return this.service.update(+id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un registro en ConfiguracionLocal' })
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }
}
