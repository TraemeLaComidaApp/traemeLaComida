import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';

@Injectable()
export class ProductoService {
  private readonly tableName = 'producto';

  constructor(private readonly supabaseService: SupabaseService) { }

  async create(createDto: CreateProductoDto) {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .insert(createDto)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async findAll() {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .select('*');

    if (error) throw error;
    return data;
  }

  async findOne(id: number) {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundException('Recurso no encontrado');
    return data;
  }

  async update(id: number, updateDto: UpdateProductoDto) {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .update(updateDto)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundException('Recurso no encontrado');
    return data;
  }

  async remove(id: number) {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .delete()
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundException('Recurso no encontrado');
    return data;
  }

  async upsertWithImage(id: number | null, payload: any, file: Express.Multer.File) {
    const supabase = this.supabaseService.getClient();
    let finalImageUrl = payload.imagen_url;

    // 1. SUBIR LA FOTO AL STORAGE
    if (file) {
      const fileExt = file.originalname.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('productos')
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: true,
        });

      if (uploadError) {
        throw new Error('Error subiendo imagen de producto a Supabase: ' + uploadError.message);
      }

      const { data: publicUrlData } = supabase.storage
        .from('productos')
        .getPublicUrl(fileName);

      finalImageUrl = publicUrlData.publicUrl;
    }

    // 2. LIMPIEZA Y PREPARACIÓN DE DATOS (Aseguramos nombres de columna SQL)
    // Borramos posibles nombres incorrectos que vengan del frontend
    const { imagen, img, desc, visible, ...cleanPayload } = payload;

    const dataToSave = {
      ...cleanPayload,
      descripcion: desc || payload.descripcion, // Por si acaso viene de ambas formas
      imagen_url: finalImageUrl,
      disponible: payload.disponible ?? true,
    };

    // 3. GUARDAR EN DB
    if (id) {
      const { data, error } = await supabase
        .from(this.tableName)
        .update(dataToSave)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new NotFoundException('Producto no encontrado para actualizar');
      return data;
    } else {
      const { data, error } = await supabase
        .from(this.tableName)
        .insert(dataToSave)
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    }
  }
}
