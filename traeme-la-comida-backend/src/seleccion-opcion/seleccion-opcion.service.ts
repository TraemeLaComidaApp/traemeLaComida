import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateSeleccionOpcionDto } from './dto/create-seleccion-opcion.dto';
import { UpdateSeleccionOpcionDto } from './dto/update-seleccion-opcion.dto';

@Injectable()
export class SeleccionOpcionService {
  private readonly tableName = 'seleccion_opcion';

  constructor(private readonly supabaseService: SupabaseService) {}

  async create(createDto: CreateSeleccionOpcionDto) {
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

  async findByDetallePedido(idDetallePedido: number) {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .select('*')
      .eq('id_detalle_pedido', idDetallePedido);

    if (error) throw error;
    return data;
  }

  async findByOpcion(idOpcion: number) {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .select('*')
      .eq('id_opcion', idOpcion);

    if (error) throw error;
    return data;
  }

  async update(idDetallePedido: number, idOpcion: number, updateDto: UpdateSeleccionOpcionDto) {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .update(updateDto)
      .eq('id_detalle_pedido', idDetallePedido)
      .eq('id_opcion', idOpcion)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new NotFoundException('Recurso no encontrado');
    return data;
  }

  async remove(idDetallePedido: number, idOpcion: number) {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .delete()
      .eq('id_detalle_pedido', idDetallePedido)
      .eq('id_opcion', idOpcion)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new NotFoundException('Recurso no encontrado');
    return data;
  }
}
