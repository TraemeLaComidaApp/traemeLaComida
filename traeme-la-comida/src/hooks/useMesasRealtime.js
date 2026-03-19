import { useState, useEffect, useRef } from 'react';
import { fetchApi } from '../services/apiClient';

export const useMesasRealtime = () => {
    const [mesas, setMesas] = useState([]);
    const [salas, setSalas] = useState([]);
    const readosCountRef = useRef(0);

    const cargarMesas = async () => {
        try {
            const [dbSalas, dbMesas, sesiones, pedidos, detalles, productos] = await Promise.all([
                fetchApi('/sala'),
                fetchApi('/mesa'),
                fetchApi('/sesion'),
                fetchApi('/pedido'),
                fetchApi('/detalle-pedido'),
                fetchApi('/producto')
            ]);

            const validSalas = dbSalas || [];
            validSalas.sort((a, b) => a.id - b.id);
            setSalas(validSalas);

            const dbSesiones = (sesiones || []).filter(s => s.estado !== 'Cerrada' && s.estado !== 'Completado');
            const dbPedidos = (pedidos || []).filter(p => ['Recibido', 'En_preparacion', 'Listo_para_servir'].includes(p.estado));
            
            if (!dbMesas) return;

            let readyItemsCount = 0;

            const mesasFormated = dbMesas.map(m => {
                const sesionActiva = dbSesiones.find(s => s.id_mesa === m.id);
                const pedidoActivo = sesionActiva ? dbPedidos.find(p => p.id_sesion === sesionActiva.id) : null;
                
                const pedidoItems = [];
                if (pedidoActivo) {
                    const detOfPedido = (detalles || []).filter(d => d.id_pedido === pedidoActivo.id);
                    detOfPedido.forEach(det => {
                        const prod = (productos || []).find(pr => pr.id === det.id_producto);
                        
                        if (det.esta_listo) {
                            readyItemsCount++;
                        }

                        pedidoItems.push({
                            idDetalle: det.id,
                            idProd: det.id_producto,
                            nombre: prod?.nombre || 'Producto',
                            precio: det.precio_unitario,
                            cantidad: det.cantidad,
                            estadoItem: det.esta_listo ? 'listo' : 'preparando',
                            notas: det.notas
                        });
                    });
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
                    necesitaCobro: sesionActiva?.estado === 'Pendiente_cobro',
                    metodoPago: null,
                    pedido: pedidoItems,
                    sesionId: sesionActiva?.id,
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