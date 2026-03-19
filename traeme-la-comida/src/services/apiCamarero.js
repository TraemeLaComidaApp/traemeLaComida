import { fetchApi } from './apiClient';

export const añadirAComanda = async (mesaId, sesionId, pedidoId, producto) => {
    let currentSesionId = sesionId;
    let currentPedidoId = pedidoId;

    if (!currentSesionId) {
        const newSesion = await fetchApi('/sesion', {
            method: 'POST',
            body: JSON.stringify({
                id_mesa: mesaId,
                estado: 'Por_defecto',
                fecha_inicio: new Date().toISOString()
            })
        });
        currentSesionId = newSesion.id;
    }

    if (!currentPedidoId) {
        const newPedido = await fetchApi('/pedido', {
            method: 'POST',
            body: JSON.stringify({
                id_sesion: currentSesionId,
                estado: 'Recibido',
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
            body: JSON.stringify({ estado: 'listo' })
        });
    }
};

export const solicitarCobro = async (sesionId) => {
    await fetchApi(`/sesion/${sesionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: 'Pendiente_cobro' })
    });
};

export const cobrarYFinalizarMesa = async (sesionId, pedidoId, totalCalculado, metodoPago) => {
    await fetchApi('/pago', {
        method: 'POST',
        body: JSON.stringify({
            id_sesion: sesionId,
            id_pedido: pedidoId,
            monto_pagado: totalCalculado,
            metodo: metodoPago,
            fecha_pago: new Date().toISOString()
        })
    });

    await fetchApi(`/pedido/${pedidoId}`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: 'Completado' })
    });

    await fetchApi(`/sesion/${sesionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: 'Cerrada', fecha_fin: new Date().toISOString() })
    });
};

export const simularPlatoListo = async (detalleId) => {
    await fetchApi(`/detalle-pedido/${detalleId}`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: 'listo' })
    });
};
