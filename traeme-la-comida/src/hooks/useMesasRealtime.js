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

            const dbPedidos = (Array.isArray(pedidos) ? pedidos : []).filter(p => {
                if (p.es_barra) {
                    if (p.estado === 'cerrado') {
                        const dts = Array.isArray(detalles) ? detalles.filter(d => d.id_pedido === p.id) : [];
                        return dts.length > 0 && dts.some(d => d.estado !== 'servido');
                    }
                    return true;
                }
                return p.estado !== 'cerrado';
            });
            const dbPagos = Array.isArray(pagos) ? pagos : [];
            
            if (!dbMesas) return;

            let readyItemsCount = 0;

            const mesasFormated = (Array.isArray(dbMesas) ? dbMesas : []).map(m => {
                const isBarra = m.tipo === 'barra';
                const pedidosParaMesa = isBarra 
                     ? dbPedidos.filter(p => p.id_mesa === m.id)
                     : dbPedidos.filter(p => p.id_mesa === m.id).slice(0, 1);
                
                const pedidoActivo = pedidosParaMesa[0];
                let metodoEncontrado = null;
                
                const pedidoItems = [];
                
                pedidosParaMesa.forEach(pedidoItemActivo => {
                    const detOfPedido = (Array.isArray(detalles) ? detalles : []).filter(d => d.id_pedido === pedidoItemActivo.id);
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
                            notas: det.notas,
                            idPedido: pedidoItemActivo.id
                        });
                    });

                    // --- DETECTAR MÉTODO DE PAGO ---
                    if (!metodoEncontrado) {
                        const itemsConMetodo = detOfPedido
                            .filter(d => d.estado !== 'pagado' && d.metodo_pago_solicitado)
                            .sort((a, b) => b.id - a.id);

                        if (itemsConMetodo.length > 0) {
                            metodoEncontrado = itemsConMetodo[0].metodo_pago_solicitado;
                        }

                        if (!metodoEncontrado) {
                            const pagosDePedido = dbPagos.filter(pg => pg.id_pedido === pedidoItemActivo.id);
                            if (pagosDePedido.length > 0) {
                                const ultimoPago = [...pagosDePedido].sort((a, b) => b.id - a.id)[0];
                                metodoEncontrado = ultimoPago.metodo;
                            }
                        }
                    }
                });

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