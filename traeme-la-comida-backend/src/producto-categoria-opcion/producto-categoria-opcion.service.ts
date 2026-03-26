import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateProductoCategoriaOpcionDto } from './dto/create-producto-categoria-opcion.dto';
import { UpdateProductoCategoriaOpcionDto } from './dto/update-producto-categoria-opcion.dto';

@Injectable()
export class ProductoCategoriaOpcionService {
  private readonly tableName = 'producto_categoria_opcion';

  constructor(private readonly supabaseService: SupabaseService) {}

  async create(createDto: CreateProductoCategoriaOpcionDto) {
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

  async findByProducto(idProducto: number) {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .select('*')
      .eq('id_producto', idProducto);

    if (error) throw error;
    return data;
  }

  async findByCategoriaOpcion(idCategoriaOpcion: number) {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .select('*')
      .eq('id_categoria_opcion', idCategoriaOpcion);

    if (error) throw error;
    return data;
  }

  async update(idProducto: number, idCategoriaOpcion: number, updateDto: UpdateProductoCategoriaOpcionDto) {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .update(updateDto)
      .eq('id_producto', idProducto)
      .eq('id_categoria_opcion', idCategoriaOpcion)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundException('Recurso no encontrado');
    return data;
  }

  async remove(idProducto: number, idCategoriaOpcion: number) {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .delete()
      .eq('id_producto', idProducto)
      .eq('id_categoria_opcion', idCategoriaOpcion)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundException('Recurso no encontrado');
    return data;
  }
}
