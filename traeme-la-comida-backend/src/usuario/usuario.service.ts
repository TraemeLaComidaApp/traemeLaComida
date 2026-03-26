import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';

@Injectable()
export class UsuarioService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async create(createUsuarioDto: CreateUsuarioDto) {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('usuario')
      .insert([createUsuarioDto])
      .select();

    if (error) throw error;
    return data[0];
  }

  async findAll() {
    const client = this.supabaseService.getClient();
    const { data, error } = await client.from('usuario').select('*');

    if (error) throw error;
    return data;
  }

  async findOne(id: number) {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('usuario')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    return data;
  }

  async update(id: number, updateUsuarioDto: UpdateUsuarioDto) {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('usuario')
      .update(updateUsuarioDto)
      .eq('id', id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    return data[0];
  }

  async remove(id: number) {
    const client = this.supabaseService.getClient();
    const { error } = await client.from('usuario').delete().eq('id', id);

    if (error) throw error;
    return { deleted: true };
  }
}
