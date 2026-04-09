import { fetchApi } from './apiClient';
import { getDeviceId } from '../utils/deviceId';

/**
 * Resolve a mesa by its UUID. Used so the client view can identify
 * which physical table it is based on the UUID in the URL (from the QR code).
 */
export const getMesaByUuid = async (uuid) => {
    return await fetchApi(`/mesa/por-uuid/${uuid}`);
};

export const submitOrder = async (mesaId, esBarra, numeroPedidoBarra, carrito, callbackExit) => {
    let currentPedidoId = null;

    if (mesaId) {
        const pedidos = await fetchApi('/pedido') || [];
        const deviceId = getDeviceId();
        // Consider an active order if it's not closed
        const pedidoActivo = esBarra 
            ? pedidos.find(p => p.id_mesa === mesaId && p.estado !== 'cerrado' && p.device_id === deviceId)
            : pedidos.find(p => p.id_mesa === mesaId && p.estado !== 'cerrado');

        if (pedidoActivo) {
            currentPedidoId = pedidoActivo.id;
        } else {
            const pedidoPayload = {
                id_mesa: mesaId,
                es_barra: esBarra || false,
                device_id: deviceId,
                estado: 'recibido',
                creado_at: new Date().toISOString()
            };

            const nuevoPedido = await fetchApi('/pedido', {
                method: 'POST',
                body: JSON.stringify(pedidoPayload)
            });
            currentPedidoId = nuevoPedido.id;
        }
    } else {
        // If no mesaId (shouldn't happen in normal flow but keeping structure)
        const pedidoPayload = {
            id_mesa: null, // this will fail backend validation if not handled, but keeping structure
            es_barra: esBarra || false,
            device_id: getDeviceId(),
            estado: 'recibido',
            creado_at: new Date().toISOString()
        };
        const nuevoPedido = await fetchApi('/pedido', {
            method: 'POST',
            body: JSON.stringify(pedidoPayload)
        });
        currentPedidoId = nuevoPedido.id;
    }

    for (const item of carrito) {
        const extraSum = item.extrasAplicados ? item.extrasAplicados.reduce((s, e) => s + (e.opcionSeleccionada?.suplemento || 0), 0) : 0;
        const totalPorUnidad = Number(item.producto.precio) + extraSum;
        const notasFromExtras = item.extrasAplicados ? item.extrasAplicados.map(e => e.opcionSeleccionada?.nombre).join(', ') : '';
        const notasBase = item.notaPersonal || notasFromExtras;
        const notaFinal = (esBarra && numeroPedidoBarra) ? `[Ticket #${numeroPedidoBarra}] ${notasBase}`.trim() : notasBase;

        const detPayload = {
            id_pedido: currentPedidoId,
            id_producto: item.producto.id,
            cantidad: item.cantidad || 1,
            precio_unitario: totalPorUnidad,
            estado: 'no_servido', // Swagger equivalent logic for 'Pendiente' / waiting
            notas: notaFinal
        };

        const detalleC = await fetchApi('/detalle-pedido', {
            method: 'POST',
            body: JSON.stringify(detPayload)
        });

        if (item.extrasAplicados && item.extrasAplicados.length > 0) {
            for (const extra of item.extrasAplicados) {
                if (extra.opcionSeleccionada) {
                    await fetchApi('/seleccion-opcion', {
                        method: 'POST',
                        body: JSON.stringify({
                            id_opcion: extra.opcionSeleccionada.id,
                            id_detalle_pedido: detalleC.id,
                            precio_extra_aplicado: extra.opcionSeleccionada.suplemento || 0
                        })
                    });
                }
            }
        }
    }
};

/**
 * Get active pedido for a mesa
 */
export const getPedidoActivo = async (mesaId, esBarra = false) => {
    const pedidos = await fetchApi('/pedido') || [];
    if (esBarra) {
        const deviceId = getDeviceId();
        return pedidos.find(p => p.id_mesa === mesaId && p.estado !== 'cerrado' && p.device_id === deviceId);
    }
    return pedidos.find(p => p.id_mesa === mesaId && p.estado !== 'cerrado');
};

/**
 * Get all order details (items) for a pedido
 */
export const getDetallesPedido = async (pedidoId) => {
    const todosDetalles = await fetchApi('/detalle-pedido') || [];
    return todosDetalles.filter(d => d.id_pedido === pedidoId);
};

/**
 * Mark a specific item as paid (or update its status)
 */
export const actualizarEstadoDetalle = async (detalleId, nuevoEstado, metodoPago = null) => {
    const body = { estado: nuevoEstado };
    if (metodoPago) body.metodo_pago_solicitado = metodoPago;
    
    return await fetchApi(`/detalle-pedido/${detalleId}`, {
        method: 'PATCH',
        body: JSON.stringify(body)
    });
};

/**
 * Register a payment in the database
 */
export const registrarPago = async (pedidoId, monto, metodo) => {
    return await fetchApi('/pago', {
        method: 'POST',
        body: JSON.stringify({
            id_pedido: pedidoId,
            monto_pagado: monto,
            metodo: metodo,
            fecha_pago: new Date().toISOString()
        })
    });
};

/**
 * Update order state to request payment
 */
export const solicitarPago = async (mesaId, metodo = 'Efectivo') => {
    const pedidoActivo = await getPedidoActivo(mesaId);
    if (pedidoActivo) {
        await fetchApi(`/pedido/${pedidoActivo.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
                estado: 'pendiente_cobro'
            })
        });
    }
};

/**
 * Finalize pedido and regenerate mesa UUID
 */
export const finalizarPedido = async (pedidoId, mesaId) => {
    const { generateUuid } = await import('../utils/uuid');

    // Close pedido
    await fetchApi(`/pedido/${pedidoId}`, {
        method: 'PATCH',
        body: JSON.stringify({
            estado: 'cerrado',
            fecha_final: new Date().toISOString()
        })
    });

    // Invalidate QR by changing mesa UUID
    if (mesaId) {
        await fetchApi(`/mesa/${mesaId}`, {
            method: 'PATCH',
            body: JSON.stringify({ uuid: generateUuid() })
        });
    }
};

/**
 * We no longer have an explicit "call waiter" state in the DB if we only use pedido state.
 * But we could use 'activo' or similar if needed. We'll leave it as a no-op or specific state if added later.
 * Wait, the old useMesasRealtime read 'Peticion_asistencia'. We don't have that in enum.
 * So 'llamarCamarero' should probably be managed outside or skipped.
 * For now we'll do nothing, since the enum doesn't support 'Peticion_asistencia'.
 */
export const llamarCamarero = async (mesaId) => {
    await fetchApi(`/mesa/${mesaId}/asistencia`, {
        method: 'POST'
    });
};
