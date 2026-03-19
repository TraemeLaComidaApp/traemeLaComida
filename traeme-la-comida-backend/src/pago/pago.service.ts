import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreatePagoDto } from './dto/create-pago.dto';
import { UpdatePagoDto } from './dto/update-pago.dto';

@Injectable()
export class PagoService {
  private readonly tableName = 'pago';

  constructor(private readonly supabaseService: SupabaseService) {}

  async create(createDto: CreatePagoDto) {
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

  async findBySesion(idSesion: number) {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .select('*')
      .eq('id_sesion', idSesion);

    if (error) throw error;
    return data;
  }

  async findByPedido(idPedido: number) {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .select('*')
      .eq('id_pedido', idPedido);

    if (error) throw error;
    return data;
  }

  async update(idSesion: number, idPedido: number, updateDto: UpdatePagoDto) {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .update(updateDto)
      .eq('id_sesion', idSesion)
      .eq('id_pedido', idPedido)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new NotFoundException('Recurso no encontrado');
    return data;
  }

  async remove(idSesion: number, idPedido: number) {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .delete()
      .eq('id_sesion', idSesion)
      .eq('id_pedido', idPedido)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new NotFoundException('Recurso no encontrado');
    return data;
  }
}
