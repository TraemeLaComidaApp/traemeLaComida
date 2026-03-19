import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateDetallePedidoDto } from './dto/create-detalle-pedido.dto';
import { UpdateDetallePedidoDto } from './dto/update-detalle-pedido.dto';

@Injectable()
export class DetallePedidoService {
  private readonly tableName = 'detalle_pedido';

  constructor(private readonly supabaseService: SupabaseService) {}

  async create(createDto: CreateDetallePedidoDto) {
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

  async findByPedido(idPedido: number) {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .select('*')
      .eq('id_pedido', idPedido);

    if (error) throw error;
    return data;
  }

  async findByProducto(idProducto: number) {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .select('*')
      .eq('id_producto', idProducto);

    if (error) throw error;
    return data;
  }

  async update(id: number, updateDto: UpdateDetallePedidoDto) {
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
