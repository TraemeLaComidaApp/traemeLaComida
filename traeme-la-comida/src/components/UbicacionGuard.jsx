import React, { useState, useEffect } from 'react';

// --- INTERRUPTOR DE DESARROLLO ---
// Pon esto en 'true' para probar en tu PC sin que te pida el GPS.
// ¡Acuérdate de ponerlo en 'false' cuando lo subas a producción!
const MODO_DESARROLLO = true;

// Coordenadas de tu restaurante
const RESTAURANTE_COORDS = {
    lat: 40.416775,
    lng: -3.703790
};
const RADIO_MAXIMO_METROS = 100; // Un margen generoso por si el GPS falla un poco

export default function UbicacionGuard({ children }) {
    // Si estamos en modo desarrollo, el estado inicial es 'concedido' (pasa directo).
    // Si no, empieza en 'pendiente' (pide el GPS).
    const [estado, setEstado] = useState(MODO_DESARROLLO ? 'concedido' : 'pendiente');
    const [mensajeError, setMensajeError] = useState('');

    const calcularDistancia = (lat1, lon1, lat2, lon2) => {
        const R = 6371e3;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const solicitarUbicacion = () => {
        setEstado('validando');

        if (!navigator.geolocation) {
            setEstado('error');
            setMensajeError('Tu navegador no soporta geolocalización.');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const distancia = calcularDistancia(
                    pos.coords.latitude,
                    pos.coords.longitude,
                    RESTAURANTE_COORDS.lat,
                    RESTAURANTE_COORDS.lng
                );

                if (distancia <= RADIO_MAXIMO_METROS) {
                    setEstado('concedido');
                } else {
                    setEstado('error');
                    setMensajeError('Parece que no estás en el establecimiento. Por seguridad, solo aceptamos pedidos locales.');
                }
            },
            (error) => {
                setEstado('error');
                setMensajeError('Necesitamos tu ubicación para confirmar que estás en el local y evitar pedidos falsos.');
            },
            { enableHighAccuracy: true }
        );
    };

    // Si tiene permiso (o estamos en modo desarrollo), pintamos la app (VistaCliente o VistaBarra)
    if (estado === 'concedido') return <>{children}</>;

    // Si no, mostramos el cartel de bloqueo
    return (
        <div style={styles.overlay}>
            <div style={styles.card}>
                <div style={styles.icon}>📍</div>
                <h2 style={styles.title}>Verificación de seguridad</h2>
                <p style={styles.text}>
                    Para realizar pedidos desde tu mesa, necesitamos confirmar mediante el GPS que te encuentras en el restaurante.
                </p>

                {estado === 'error' && (
                    <div style={styles.errorBox}>
                        {mensajeError}
                    </div>
                )}

                <button
                    onClick={solicitarUbicacion}
                    style={styles.button}
                    disabled={estado === 'validando'}
                >
                    {estado === 'validando' ? 'Verificando...' : 'Confirmar mi ubicación'}
                </button>
            </div>
        </div>
    );
}

const styles = {
    overlay: {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px', zIndex: 9999
    },
    card: {
        backgroundColor: '#fff', padding: '40px 30px', borderRadius: '20px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)', textAlign: 'center', maxWidth: '400px'
    },
    icon: { fontSize: '50px', marginBottom: '20px' },
    title: { fontSize: '22px', color: '#333', marginBottom: '15px' },
    text: { color: '#666', lineHeight: '1.5', marginBottom: '25px' },
    errorBox: {
        backgroundColor: '#fee2e2', color: '#dc2626', padding: '15px',
        borderRadius: '10px', marginBottom: '20px', fontSize: '14px'
    },
    button: {
        backgroundColor: '#e67e22', color: '#fff', border: 'none',
        padding: '15px 30px', borderRadius: '30px', fontSize: '16px',
        fontWeight: 'bold', cursor: 'pointer', width: '100%', transition: '0.3s'
    }
};