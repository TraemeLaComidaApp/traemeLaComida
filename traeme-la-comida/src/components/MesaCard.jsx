import { useEffect, useState } from 'react';
import { obtenerMesas } from '../services/apiService';
import { supabase } from '../lib/supabaseClient';

export function VistaMesas() {
    const [mesas, setMesas] = useState([]);

    // Función para cargar los datos
    const cargarDatos = async () => {
        const datos = await obtenerMesas();
        setMesas(datos);
    };

    useEffect(() => {
        // 1. Carga inicial
        cargarDatos();

        // 2. Suscripción en tiempo real
        const canal = supabase
            .channel('cambios-mesas')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'mesas' },
                (payload) => {
                    console.log('¡Algo cambió!', payload);
                    cargarDatos(); // Volvemos a pedir los datos cuando hay un cambio
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(canal);
        };
    }, []);

    return (
        <div>
            {/* Aquí dibujas tus mesas con mesas.map(...) */}
        </div>
    );
}