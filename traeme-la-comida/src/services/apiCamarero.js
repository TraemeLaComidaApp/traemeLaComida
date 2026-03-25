import { fetchApi } from './apiClient';
import { generateUuid } from '../utils/uuid';

export const añadirAComanda = async (mesaId, pedidoId, producto) => {
    let currentPedidoId = pedidoId;

    if (!currentPedidoId) {
        const newPedido = await fetchApi('/pedido', {
            method: 'POST',
            body: JSON.stringify({
                id_mesa: mesaId,
                estado: 'recibido',
                es_barra: false,
                creado_at: new Date().toISOString()
            })
        });
        currentPedidoId = newPedido.id;
    }

    await fetchApi('/detalle-pedido', {
        method: 'POST',
        body: JSON.stringify({
            id_pedido: currentPedidoId,
            id_producto: producto.id,
            cantidad: 1,
            precio_unitario: producto.precio,
            estado: 'no_servido'
        })
    });
};

export const eliminarProductoDelPedido = async (detalleId) => {
    await fetchApi(`/detalle-pedido/${detalleId}`, { method: 'DELETE' });
};

export const servirDetalles = async (detallesIds) => {
    for (const dId of detallesIds) {
        await fetchApi(`/detalle-pedido/${dId}`, {
            method: 'PATCH',
            body: JSON.stringify({ estado: 'servido' })
        });
    }
};

export const solicitarCobro = async (pedidoId) => {
    await fetchApi(`/pedido/${pedidoId}`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: 'pendiente_cobro' })
    });
};

export const cobrarYFinalizarMesa = async (pedidoId, mesaId, totalCalculado, metodoPago) => {
    await fetchApi('/pago', {
        method: 'POST',
        body: JSON.stringify({
            id_pedido: pedidoId,
            monto_pagado: totalCalculado,
            metodo: metodoPago,
            fecha_pago: new Date().toISOString()
        })
    });

    await fetchApi(`/pedido/${pedidoId}`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: 'cerrado', fecha_final: new Date().toISOString() })
    });

    // Regenerate UUID so the table's QR link is invalidated after payment
    await fetchApi(`/mesa/${mesaId}`, {
        method: 'PATCH',
        body: JSON.stringify({ uuid: generateUuid() })
    });
};

export const simularPlatoListo = async (detalleId) => {
    await fetchApi(`/detalle-pedido/${detalleId}`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: 'listo' })
    });
};

export const limpiarAsistencia = async (mesaId) => {
    await fetchApi(`/mesa/${mesaId}/asistencia`, {
        method: 'DELETE'
    });
};
