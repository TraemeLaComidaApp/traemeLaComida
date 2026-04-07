import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
//import { Express } from 'express';
import { ConfiguracionLocalService } from './configuracion-local.service';
import { CreateConfiguracionLocalDto } from './dto/create-configuracion-local.dto';
import { UpdateConfiguracionLocalDto } from './dto/update-configuracion-local.dto';

@ApiTags('ConfiguracionLocal')
@Controller('configuracion-local')
export class ConfiguracionLocalController {
  constructor(private readonly service: ConfiguracionLocalService) { }

  @Post()
  @ApiOperation({ summary: 'Crear un registro en ConfiguracionLocal (Solo texto)' })
  create(@Body() createDto: CreateConfiguracionLocalDto) {
    return this.service.create(createDto);
  }

  // --- NUEVO: Endpoint para CREAR enviando un archivo físico ---
  @Post('upload')
  @ApiOperation({ summary: 'Crear un registro subiendo el Logo físico' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        nombre_local: { type: 'string' },
        color_primario: { type: 'string' },
        link_resenas_google: { type: 'string' },
        logo: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('logo'))
  createWithLogo(
    @Body() body: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.upsertWithLogo(null, body, file);
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
  @ApiOperation({ summary: 'Actualizar un registro en ConfiguracionLocal (Solo texto)' })
  update(@Param('id') id: string, @Body() updateDto: UpdateConfiguracionLocalDto) {
    return this.service.update(+id, updateDto);
  }

  // --- NUEVO: Endpoint para ACTUALIZAR enviando un archivo físico ---
  @Patch('upload/:id')
  @ApiOperation({ summary: 'Actualizar un registro subiendo un Logo físico' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        nombre_local: { type: 'string' },
        color_primario: { type: 'string' },
        link_resenas_google: { type: 'string' },
        logo: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('logo'))
  updateWithLogo(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.upsertWithLogo(+id, body, file);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un registro en ConfiguracionLocal' })
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }
}
