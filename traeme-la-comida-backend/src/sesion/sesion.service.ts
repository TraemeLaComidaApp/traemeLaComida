import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateSesionDto } from './dto/create-sesion.dto';
import { UpdateSesionDto } from './dto/update-sesion.dto';

@Injectable()
export class SesionService {
  private readonly tableName = 'sesion';

  constructor(private readonly supabaseService: SupabaseService) {}

  async create(createDto: CreateSesionDto) {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .insert(createDto)
      .select()
      .single();

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
      .single();

    if (error) throw error;
    if (!data) throw new NotFoundException('Recurso no encontrado');
    return data;
  }

  async update(id: number, updateDto: UpdateSesionDto) {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .update(updateDto)
      .eq('id', id)
      .select()
      .single();

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
      .single();

    if (error) throw error;
    if (!data) throw new NotFoundException('Recurso no encontrado');
    return data;
  }
}
