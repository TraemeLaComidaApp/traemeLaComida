import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateConfiguracionLocalDto } from './dto/create-configuracion-local.dto';
import { UpdateConfiguracionLocalDto } from './dto/update-configuracion-local.dto';

@Injectable()
export class ConfiguracionLocalService {
  private readonly tableName = 'configuracion_local';

  constructor(private readonly supabaseService: SupabaseService) {}

  async create(createDto: CreateConfiguracionLocalDto) {
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

  async update(id: number, updateDto: UpdateConfiguracionLocalDto) {
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

  // --- NUEVA FUNCIÓN: Maneja la subida del archivo a Supabase Storage y actualiza/crea en BD ---
  async upsertWithLogo(id: number | null, body: any, file: Express.Multer.File) {
    const supabase = this.supabaseService.getClient();
    let logo_url = undefined;

    // 1. SI HAY ARCHIVO, LO SUBIMOS AL STORAGE
    if (file) {
      // Generamos un nombre aleatorio para que no pise fotos antiguas
      const fileExt = file.originalname.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('logo') // Asegúrate de que el bucket de Supabase se llama "logo" en minúsculas
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: true,
        });

      if (uploadError) {
        throw new Error('Error al subir la imagen al Storage: ' + uploadError.message);
      }

      // 2. OBTENEMOS LA URL PÚBLICA
      const { data: publicUrlData } = supabase.storage
        .from('logo')
        .getPublicUrl(fileName);

      logo_url = publicUrlData.publicUrl;
    }

    // 3. PREPARAMOS LOS DATOS PARA LA BASE DE DATOS
    const payload: any = { ...body };
    if (logo_url) payload.logo_url = logo_url;

    // 4. GUARDAMOS EN BASE DE DATOS (Actualizar si hay ID, Insertar si no hay ID)
    if (id) {
      const { data, error } = await supabase
        .from(this.tableName)
        .update(payload)
        .eq('id', id)
        .select()
        .maybeSingle();
        
      if (error) throw error;
      if (!data) throw new NotFoundException('Recurso no encontrado para actualizar');
      return data;
    } else {
      const { data, error } = await supabase
        .from(this.tableName)
        .insert(payload)
        .select()
        .maybeSingle();
        
      if (error) throw error;
      return data;
    }
  }
}
