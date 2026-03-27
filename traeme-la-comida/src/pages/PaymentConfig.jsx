import React, { useState } from 'react';
import './PaymentConfig.css';

const initialMethods = [
    { id: 'bizum', name: 'Bizum', desc: 'Pago instantáneo móvil', icon: 'smartphone', active: true },
    { id: 'gpay', name: 'Google Pay', desc: 'Cartera digital rápida', icon: 'contactless', active: true },
    { id: 'card', name: 'Tarjeta Bancaria', desc: 'Crédito o Débito', icon: 'credit_card', active: true },
    { id: 'cash', name: 'Efectivo', desc: 'Pago presencial en barra', icon: 'payments', active: false },
];

export default function PaymentConfig() {
    const [methods, setMethods] = useState(initialMethods);
    const [guardando, setGuardando] = useState(false);
    const [mostrarExito, setMostrarExito] = useState(false);

    const toggleMethod = (id) => {
        setMethods(methods.map(method =>
            method.id === id ? { ...method, active: !method.active } : method
        ));
        // Si el usuario cambia algo, ocultamos el mensaje de éxito anterior
        setMostrarExito(false);
    };

    const manejarGuardar = () => {
        setGuardando(true);

        // Simulamos una petición al servidor de 1.5 segundos
        setTimeout(() => {
            setGuardando(false);
            setMostrarExito(true);

            // Ocultar el mensaje de éxito automáticamente después de 3 segundos
            setTimeout(() => setMostrarExito(false), 3000);
        }, 1500);
    };

    return (
        <div className="payment-container">
            <div className="payment-header">
                <h2>Configuración de Pagos</h2>
                <p>Activa los métodos que quieres ofrecer a tus clientes.</p>
            </div>

            <div className="alert-box">
                <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>verified_user</span>
                <p>La pasarela de pago ha sido configurada correctamente por el administrador.</p>
            </div>

            <div className="methods-list">
                {methods.map((method) => (
                    <div className={`method-item ${method.active ? 'is-active' : ''}`} key={method.id}>
                        <div className="method-info">
                            <div className="method-icon">
                                <span className="material-symbols-outlined">{method.icon}</span>
                            </div>
                            <div className="method-details">
                                <h4>{method.name}</h4>
                                <p>{method.desc}</p>
                            </div>
                        </div>

                        <label className="switch-label">
                            <input
                                type="checkbox"
                                checked={method.active}
                                onChange={() => toggleMethod(method.id)}
                            />
                            <span className="slider"></span>
                        </label>
                    </div>
                ))}
            </div>

            <div className="footer-actions">
                <button
                    className={`btn-primary ${guardando ? 'loading' : ''}`}
                    onClick={manejarGuardar}
                    disabled={guardando}
                >
                    {guardando ? 'Guardando...' : 'Aplicar cambios'}
                </button>

                {mostrarExito && (
                    <div className="success-toast">
                        <span className="material-symbols-outlined">check_circle</span>
                        Cambios guardados correctamente
                    </div>
                )}
            </div>
        </div>
    );
}