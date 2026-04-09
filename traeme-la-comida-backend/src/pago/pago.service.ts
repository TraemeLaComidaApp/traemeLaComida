import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreatePagoDto } from './dto/create-pago.dto';
import { UpdatePagoDto } from './dto/update-pago.dto';
import Stripe from 'stripe';

@Injectable()
export class PagoService {
  private readonly tableName = 'pago';
  private stripe: any;

  constructor(private readonly supabaseService: SupabaseService) {
      // Initialize Stripe, bypass strict apiVersion typing
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_51TKFrkASdC4IwfpKTzLCzvvNTAl6JNg0DLJtzhj8tBhh1LXwZkb55pI7BMAW4cJTtxvBaAH0YgPS8rsB7GIawPQR00T7Ux5Gaw');
  }

  async createPaymentIntent(monto: number) {
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(monto * 100), // Stripe expects cents
      currency: 'eur',
      // Enable automatic payment methods for Element
      automatic_payment_methods: {
        enabled: true,
      },
    });
    return { clientSecret: paymentIntent.client_secret };
  }


  async create(createDto: CreatePagoDto) {
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



  async findByPedido(idPedido: number) {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .select('*')
      .eq('id_pedido', idPedido);

    if (error) throw error;
    return data;
  }

  async update(idPedido: number, updateDto: UpdatePagoDto) {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .update(updateDto)
      .eq('id_pedido', idPedido)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundException('Recurso no encontrado');
    return data;
  }

  async remove(idPedido: number) {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .delete()
      .eq('id_pedido', idPedido)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundException('Recurso no encontrado');
    return data;
  }
}
