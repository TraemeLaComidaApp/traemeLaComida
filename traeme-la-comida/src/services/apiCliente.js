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
