import { fetchApi } from './apiClient';

/**
 * Resolve a mesa by its UUID. Used so the client view can identify
 * which physical table it is based on the UUID in the URL (from the QR code).
 */
export const getMesaByUuid = async (uuid) => {
    return await fetchApi(`/mesa/por-uuid/${uuid}`);
};

export const submitOrder = async (mesaId, esBarra, numeroPedidoBarra, carrito, callbackExit) => {
    let currentSesionId = null;

    if (mesaId) {
        const sesiones = await fetchApi('/sesion') || [];
        // Consider an active session if it's not logically closed or complete based on available state
        const sesionActiva = sesiones.find(s => s.id_mesa === mesaId && s.estado !== 'Cerrada' && s.estado !== 'Completado');

        if (sesionActiva) {
            currentSesionId = sesionActiva.id;
        } else {
            const newSesion = await fetchApi('/sesion', {
                method: 'POST',
                body: JSON.stringify({
                    id_mesa: mesaId,
                    estado: 'Pedido_realizado',
                    fecha_inicio: new Date().toISOString()
                })
            });
            currentSesionId = newSesion.id;
        }
    }

    const pedidoPayload = {
        id_sesion: currentSesionId,
        es_barra: esBarra || false,
        estado: 'Recibido',
        creado_at: new Date().toISOString()
    };

    // Some backend endpoints ignore unknown keys, we avoid passing num_pedido_barra if it wasn't in CreatePedidoDto
    // but just in case we can safely keep to Swagger spec.
    const pedidoC = await fetchApi('/pedido', {
        method: 'POST',
        body: JSON.stringify(pedidoPayload)
    });
    const currentPedidoId = pedidoC.id;

    for (const item of carrito) {
        const extraSum = item.extrasAplicados ? item.extrasAplicados.reduce((s, e) => s + (e.opcionSeleccionada?.suplemento || 0), 0) : 0;
        const totalPorUnidad = Number(item.producto.precio) + extraSum;
        const notasFromExtras = item.extrasAplicados ? item.extrasAplicados.map(e => e.opcionSeleccionada?.nombre).join(', ') : '';

        const detPayload = {
            id_pedido: currentPedidoId,
            id_producto: item.producto.id,
            cantidad: item.cantidad || 1,
            precio_unitario: totalPorUnidad,
            estado: 'no_servido', // Swagger equivalent logic for 'Pendiente' / waiting
            notas: item.notaPersonal || notasFromExtras
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
 * Get active session for a mesa
 */
export const getSesionActiva = async (mesaId) => {
    const sesiones = await fetchApi('/sesion') || [];
    return sesiones.find(s => s.id_mesa == mesaId && s.estado !== 'Cerrada' && s.estado !== 'Completado');
};

/**
 * Get all order details (items) for a session
 */
export const getDetallesSesion = async (sesionId) => {
    // We first get all pedidos for this session
    const pedidos = await fetchApi('/pedido') || [];
    const pedidosSesion = pedidos.filter(p => p.id_sesion === sesionId);
    
    // Then get all detalles for those pedidos
    const todosDetalles = await fetchApi('/detalle-pedido') || [];
    return todosDetalles.filter(d => pedidosSesion.some(p => p.id === d.id_pedido));
};

/**
 * Mark a specific item as paid (or update its status)
 */
export const actualizarEstadoDetalle = async (detalleId, nuevoEstado) => {
    return await fetchApi(`/detalle-pedido/${detalleId}`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: nuevoEstado })
    });
};

/**
 * Register a payment in the database
 */
export const registrarPago = async (sesionId, monto, metodo) => {
    return await fetchApi('/pago', {
        method: 'POST',
        body: JSON.stringify({
            id_sesion: sesionId,
            monto_pagado: monto,
            metodo: metodo,
            fecha_pago: new Date().toISOString()
        })
    });
};

/**
 * Update session state to request payment
 */
export const solicitarPago = async (mesaId, metodo = 'Efectivo') => {
    const sesionActiva = await getSesionActiva(mesaId);
    if (sesionActiva) {
        await fetchApi(`/sesion/${sesionActiva.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ estado: 'Pendiente_cobro' })
        });
        // We could also store the preferred method if the schema allowed it, 
        // but for now we follow the existing pattern.
    }
};

/**
 * Finalize session and regenerate mesa UUID
 */
export const finalizarSesion = async (sesionId, mesaId) => {
    const { generateUuid } = await import('../utils/uuid');
    
    // Close session
    await fetchApi(`/sesion/${sesionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ 
            estado: 'Cerrada', 
            fecha_fin: new Date().toISOString() 
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
 * Update session state to call for assistance
 */
export const llamarCamarero = async (mesaId) => {
    const sesionActiva = await getSesionActiva(mesaId);
    if (sesionActiva) {
        await fetchApi(`/sesion/${sesionActiva.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ estado: 'Peticion_asistencia' })
        });
    }
};
