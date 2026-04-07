import { fetchApi } from './apiClient';

export const getPedidosPendientesCocina = async () => {
    try {
        const [pedidos, detalles, mesas, productos] = await Promise.all([
            fetchApi('/pedido'),
            fetchApi('/detalle-pedido'),
            fetchApi('/mesa'),
            fetchApi('/producto')
        ]);

        const pedidosFiltrados = (pedidos || []).filter(p => {
            if (p.es_barra) {
                if (p.estado === 'cerrado') {
                    const dts = (detalles || []).filter(d => d.id_pedido === p.id);
                    return dts.length > 0 && dts.some(d => d.estado !== 'servido');
                }
                return true;
            }
            return p.estado !== 'cerrado';
        });
        
        const tickets = pedidosFiltrados.map(p => {
            let identificadorStr = '';
            if (p.es_barra) {
                identificadorStr = `Barra`;
            } else if (p.id_mesa) {
                const mesaObj = (mesas || []).find(m => m.id === p.id_mesa);
                identificadorStr = mesaObj ? `Mesa ${mesaObj.numero}` : `Mesa Desconocida`;
            }

            const detallesPedido = (detalles || []).filter(d => d.id_pedido === p.id);
            
            const detallesValidos = detallesPedido.filter(d => {
                if (p.es_barra) {
                    return d.estado === 'pagado' || d.estado === 'preparando' || d.estado === 'listo';
                } else {
                    return d.estado === 'no_servido' || d.estado === 'preparando' || d.estado === 'listo' || d.estado === 'pagado' || d.estado === 'solicitado_mesa';
                }
            });
            
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
