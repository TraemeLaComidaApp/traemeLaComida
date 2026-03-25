import { useState, useEffect, useRef } from 'react';
import { fetchApi } from '../services/apiClient';

export const useMesasRealtime = () => {
    const [mesas, setMesas] = useState([]);
    const [salas, setSalas] = useState([]);
    const readosCountRef = useRef(0);

    const cargarMesas = async () => {
        try {
            const [dbSalas, dbMesas, pedidos, detalles, productos, asistenciasActivas, pagos] = await Promise.all([
                fetchApi('/sala'),
                fetchApi('/mesa'),
                fetchApi('/pedido'),
                fetchApi('/detalle-pedido'),
                fetchApi('/producto'),
                fetchApi('/mesa/asistencia/activas'),
                fetchApi('/pago')
            ]);

            const validSalas = Array.isArray(dbSalas) ? dbSalas : [];
            validSalas.sort((a, b) => a.id - b.id);
            setSalas(validSalas);

            const dbPedidos = (Array.isArray(pedidos) ? pedidos : []).filter(p => p.estado !== 'cerrado');
            const dbPagos = Array.isArray(pagos) ? pagos : [];
            
            if (!dbMesas) return;

            let readyItemsCount = 0;

            const mesasFormated = (Array.isArray(dbMesas) ? dbMesas : []).map(m => {
                const pedidoActivo = dbPedidos.find(p => p.id_mesa === m.id);
                let metodoEncontrado = null;
                
                const pedidoItems = [];
                if (pedidoActivo) {
                    const detOfPedido = (Array.isArray(detalles) ? detalles : []).filter(d => d.id_pedido === pedidoActivo.id);
                    detOfPedido.forEach(det => {
                        const prod = (Array.isArray(productos) ? productos : []).find(pr => pr.id === det.id_producto);
                        
                        if (det.estado === 'listo' || det.estado === 'servido') {
                            readyItemsCount++;
                        }

                        pedidoItems.push({
                            idDetalle: det.id,
                            idProd: det.id_producto,
                            nombre: prod?.nombre || 'Producto',
                            precio: det.precio_unitario,
                            cantidad: det.cantidad,
                            estadoItem: det.estado,
                            notas: det.notas
                        });
                    });

                    // --- DETECTAR MÉTODO DE PAGO (Dentro del scope de detOfPedido) ---
                    // 1. Buscamos si algún item del pedido tiene un método solicitado explícitamente (el más reciente)
                    const itemsConMetodo = detOfPedido
                        .filter(d => d.estado !== 'pagado' && d.metodo_pago_solicitado)
                        .sort((a, b) => b.id - a.id); // Asumimos IDs mayores = más recientes

                    if (itemsConMetodo.length > 0) {
                        metodoEncontrado = itemsConMetodo[0].metodo_pago_solicitado;
                    }

                    // 2. Si no hay método solicitado en items, buscamos en los registros de la tabla pago
                    if (!metodoEncontrado) {
                        const pagosDePedido = dbPagos.filter(pg => pg.id_pedido === pedidoActivo.id);
                        if (pagosDePedido.length > 0) {
                            const ultimoPago = [...pagosDePedido].sort((a, b) => b.id - a.id)[0];
                            metodoEncontrado = ultimoPago.metodo;
                        }
                    }
                }

                return {
                    id: m.id,
                    salaId: m.id_sala,
                    numero: m.numero,
                    tipoPedido: m.tipo,
                    x: `${m.pos_x}%`,
                    y: `${m.pos_y}%`,
                    w: `${m.ancho}px`,
                    h: `${m.alto}px`,
                    necesitaCobro: pedidoActivo?.estado === 'pendiente_cobro',
                    necesitaAsistencia: (Array.isArray(asistenciasActivas) ? asistenciasActivas : []).includes(m.id),
                    estadoPedido: pedidoActivo?.estado,
                    metodoPago: metodoEncontrado,
                    pedido: pedidoItems,
                    pedidoId: pedidoActivo?.id
                };
            });

            // Alerts logic
            if (readosCountRef.current !== 0 && readyItemsCount > readosCountRef.current) {
                new Audio('/alert.mp3').play().catch(() => { });
            }
            readosCountRef.current = readyItemsCount;

            setMesas(mesasFormated);
        } catch (error) {
            console.error('Error in useMesasRealtime interval poll:', error);
        }
    };

    useEffect(() => {
        cargarMesas();
        
        // Emulate postgres changes with 3s polling
        const interval = setInterval(cargarMesas, 3000);
        return () => clearInterval(interval);
    }, []);

    return { mesas, salas };
};