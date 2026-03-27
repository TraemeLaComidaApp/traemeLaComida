import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
//import { Express } from 'express';
import { ProductoService } from './producto.service';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';

@ApiTags('Producto')
@Controller('producto')
export class ProductoController {
  constructor(private readonly service: ProductoService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un registro en Producto (Solo texto)' })
  create(@Body() createDto: CreateProductoDto) {
    return this.service.create(createDto);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Crear un Producto subiendo su foto física' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        nombre: { type: 'string' },
        descripcion: { type: 'string' },
        precio: { type: 'number' },
        id_categoria_producto: { type: 'number' },
        orden: { type: 'number' },
        disponible: { type: 'boolean' },
        imagen: { type: 'string', format: 'binary' }, 
      },
    },
  })
  @UseInterceptors(FileInterceptor('imagen'))
  createWithImage(
    @Body() body: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const payload = {
      ...body,
      precio: body.precio ? parseFloat(body.precio) : 0,
      id_categoria_producto: body.id_categoria_producto ? parseInt(body.id_categoria_producto, 10) : undefined,
      orden: body.orden ? parseInt(body.orden, 10) : 0,
      disponible: body.disponible === 'true' || body.disponible === true,
    };
    return this.service.upsertWithImage(null, payload, file);
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
  @ApiOperation({ summary: 'Actualizar un registro en Producto (Solo texto)' })
  update(@Param('id') id: string, @Body() updateDto: UpdateProductoDto) {
    return this.service.update(+id, updateDto);
  }

  @Patch('upload/:id')
  @ApiOperation({ summary: 'Actualizar un Producto subiendo una foto nueva' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        nombre: { type: 'string' },
        descripcion: { type: 'string' },
        precio: { type: 'number' },
        id_categoria_producto: { type: 'number' },
        orden: { type: 'number' },
        disponible: { type: 'boolean' },
        imagen: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('imagen'))
  updateWithImage(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const payload = { ...body };
    if (body.precio !== undefined) payload.precio = parseFloat(body.precio);
    if (body.id_categoria_producto !== undefined) payload.id_categoria_producto = parseInt(body.id_categoria_producto, 10);
    if (body.orden !== undefined) payload.orden = parseInt(body.orden, 10);
    if (body.disponible !== undefined) payload.disponible = body.disponible === 'true' || body.disponible === true;

    return this.service.upsertWithImage(+id, payload, file);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un registro en Producto' })
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }
}
