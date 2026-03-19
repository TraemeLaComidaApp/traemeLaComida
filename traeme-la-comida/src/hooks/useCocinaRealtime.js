import { useState, useEffect, useRef } from 'react';
import { getPedidosPendientesCocina } from '../services/apiCocina';

export const useCocinaRealtime = () => {
    const [pedidos, setPedidos] = useState([]);
    const [cargando, setCargando] = useState(true);
    const countRef = useRef(0);

    const cargarPedidos = async () => {
        const data = await getPedidosPendientesCocina();
        
        let currentItemCount = 0;
        data.forEach(p => {
            currentItemCount += p.items.filter(i => i.estado === 'preparando').length; 
        });

        // Simple heuristic for playing the kitchen alert sound
        if (countRef.current !== 0 && currentItemCount > countRef.current) {
            new Audio('/alert-kitchen.mp3').play().catch(() => {});
        }
        countRef.current = currentItemCount;

        setPedidos(data);
        setCargando(false);
    };

    useEffect(() => {
        cargarPedidos();

        // Use long polling instead of supabase subscriptions
        const interval = setInterval(() => {
             cargarPedidos();
        }, 3000); 

        return () => clearInterval(interval);
    }, []);

    return { pedidos, cargarPedidos, cargando };
};
