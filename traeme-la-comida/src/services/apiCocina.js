import { fetchApi } from './apiClient';

export const getPedidosPendientesCocina = async () => {
    try {
        const [pedidos, detalles, sesiones, mesas, productos] = await Promise.all([
            fetchApi('/pedido'),
            fetchApi('/detalle-pedido'),
            fetchApi('/sesion'),
            fetchApi('/mesa'),
            fetchApi('/producto')
        ]);

        const pedidosActivos = (pedidos || []).filter(p => !['Completado', 'Cancelado'].includes(p.estado));
        
        const tickets = pedidosActivos.map(p => {
            let identificadorStr = '';
            if (p.es_barra) {
                identificadorStr = `Barra`;
            } else if (p.id_sesion) {
                const sesionObj = (sesiones || []).find(s => s.id === p.id_sesion);
                if (sesionObj && sesionObj.id_mesa) {
                    const mesaObj = (mesas || []).find(m => m.id === sesionObj.id_mesa);
                    identificadorStr = mesaObj ? `Mesa ${mesaObj.numero}` : `Mesa Desconocida`;
                }
            }

            const detallesPedido = (detalles || []).filter(d => d.id_pedido === p.id);
            // Mostramos platos que NO estén servidos. El filtrado de 'listo' se hará en el componente para el historial.
            const detallesValidos = detallesPedido.filter(d => d.estado !== 'servido');
            
            if (detallesValidos.length === 0) return null;

            return {
                idPedido: p.id,
                mesaStr: identificadorStr,
                fecha: new Date(p.creado_at || Date.now()),
                items: detallesValidos.map(d => {
                    const prodObj = (productos || []).find(pr => pr.id === d.id_producto);
                    return {
                        idDetalle: d.id,
                        nombre: prodObj?.nombre || 'Desconocido',
                        cantidad: d.cantidad,
                        notas: d.notas,
                        estado: d.estado
                    }
                })
            };
        }).filter(Boolean);

        return tickets.sort((a, b) => a.fecha - b.fecha);
    } catch (err) {
        console.error("Error fetching kitchen orders:", err);
        return [];
    }
};

export const actualizarEstadoDetalle = async (detalleId, nuevoEstado) => {
    await fetchApi(`/detalle-pedido/${detalleId}`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: nuevoEstado })
    });
};

export const marcarProductoAgotado = async (nombreProducto) => {
    const productos = await fetchApi('/producto') || [];
    const prod = productos.find(pr => pr.nombre.toLowerCase().includes(nombreProducto.toLowerCase()));
    
    if (prod) {
        await fetchApi(`/producto/${prod.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ disponible: false })
        });
    }
};
