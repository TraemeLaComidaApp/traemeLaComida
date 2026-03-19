import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { UpdatePedidoDto } from './dto/update-pedido.dto';

@Injectable()
export class PedidoService {
  private readonly tableName = 'pedido';

  constructor(private readonly supabaseService: SupabaseService) {}

  async create(createDto: CreatePedidoDto) {
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

  async update(id: number, updateDto: UpdatePedidoDto) {
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
