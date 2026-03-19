import React, { useState, useEffect } from 'react';
import './VistaPropietario.css';
import MapaEditor from './MapaEditor';
import MenuEditor from './MenuEditor';
import PaymentConfig from './PaymentConfig';
import DatosNegocio from './DatosNegocio';
import { loginWithCredenciales, getCredenciales, getConfiguracionLocal } from '../services/apiAuth';

export default function VistaPropietario() {
    // --- ESTADOS DE AUTENTICACIÓN ---
    const [estaAutenticado, setEstaAutenticado] = useState(true); //CAMBIAR POR FALSE DESPUES!
    const [usuarioInput, setUsuarioInput] = useState('');
    const [passwordInput, setPasswordInput] = useState('');
    const [errorLogin, setErrorLogin] = useState(false);

    // --- ESTADOS DE RECUPERACIÓN DE CONTRASEÑA ---
    const [modoRecuperar, setModoRecuperar] = useState(false);
    const [emailRecuperacion, setEmailRecuperacion] = useState('');
    const [mensajeRecuperacion, setMensajeRecuperacion] = useState('');

    // --- ESTADOS DE NAVEGACIÓN ---
    const [tabActiva, setTabActiva] = useState('mapa');
    // Estado global para el nombre del negocio
    const [nombreNegocio, setNombreNegocio] = useState('Mi Bar de Desayunos');

    useEffect(() => {
        const fetchConfig = async () => {
            const config = await getConfiguracionLocal();
            if (config && config.nombre_local) {
                setNombreNegocio(config.nombre_local);
            }
        };
        fetchConfig();
    }, []);

    // --- LÓGICA DE LOGIN ---
    const manejarLogin = async (e) => {
        e.preventDefault();
        const { success } = await loginWithCredenciales(usuarioInput, passwordInput, 'admin');

        if (success) {
            setEstaAutenticado(true);
            setErrorLogin(false);
        } else {
            setErrorLogin(true);
            setPasswordInput('');
        }
    };

    const cerrarSesion = () => {
        setEstaAutenticado(false);
        setUsuarioInput('');
        setPasswordInput('');
        setTabActiva('mapa'); // Resetea la pestaña al salir
    };
    // --- LÓGICA DE RECUPERACIÓN ---
    const manejarRecuperacion = async (e) => {
        e.preventDefault();

        // Obtener el correo del admin de la DB
        const creds = await getCredenciales();
        const adminCred = creds.find(c => c.rol === 'admin');
        const correoRegistradoSeguro = adminCred?.email;

        if (correoRegistradoSeguro && emailRecuperacion === correoRegistradoSeguro) {
            // ¡Coincide! Enviamos el enlace a ESA bandeja de entrada.
            setMensajeRecuperacion(`✅ Hemos enviado un enlace de recuperación a ${emailRecuperacion}`);
            setTimeout(() => {
                setModoRecuperar(false);
                setMensajeRecuperacion('');
                setEmailRecuperacion('');
            }, 4000);
        } else {
            // No coincide. Bloqueamos el intento.
            setMensajeRecuperacion('❌ Este correo no coincide con el registrado en el sistema.');
        }
    };

    // --- PANTALLA DE LOGIN Y RECUPERACIÓN ---
    if (!estaAutenticado) {
        return (
            <div className="login-container">
                <div className="login-box">
                    <div className="login-header">
                        <span className="material-symbols-outlined login-icon">storefront</span>
                        <h2>Acceso Propietario</h2>
                        <p>{modoRecuperar ? 'Recupera el acceso a tu cuenta.' : 'Introduce tus credenciales para acceder al panel.'}</p>
                    </div>

                    {/* VISTA DE RECUPERACIÓN DE CONTRASEÑA */}
                    {modoRecuperar ? (
                        <form onSubmit={manejarRecuperacion} className="login-form">
                            <div className="form-group">
                                <label>Correo de Recuperación</label>
                                <input
                                    type="email"
                                    value={emailRecuperacion}
                                    onChange={(e) => setEmailRecuperacion(e.target.value)}
                                    placeholder="ejemplo@mibar.com"
                                    autoFocus
                                    required
                                />
                            </div>

                            {mensajeRecuperacion && (
                                <div className={`login-mensaje ${mensajeRecuperacion.includes('enviado') ? 'mensaje-exito' : 'login-error'}`}>
                                    {mensajeRecuperacion}
                                </div>
                            )}

                            <button type="submit" className="btn-login">
                                Enviar Enlace
                            </button>

                            <button
                                type="button"
                                className="btn-secundario-link"
                                onClick={() => { setModoRecuperar(false); setMensajeRecuperacion(''); }}
                            >
                                Volver al Inicio de Sesión
                            </button>
                        </form>

                        // VISTA DE LOGIN NORMAL
                    ) : (
                        <form onSubmit={manejarLogin} className="login-form">
                            <div className="form-group">
                                <label>Usuario</label>
                                <input
                                    type="text"
                                    value={usuarioInput}
                                    onChange={(e) => setUsuarioInput(e.target.value)}
                                    placeholder="Ej: admin"
                                    autoFocus
                                />
                            </div>

                            <div className="form-group">
                                <div className="label-con-link">
                                    <label>Contraseña</label>
                                    <button
                                        type="button"
                                        className="link-olvido"
                                        onClick={() => setModoRecuperar(true)}
                                    >
                                        ¿Has olvidado tu contraseña?
                                    </button>
                                </div>
                                <input
                                    type="password"
                                    value={passwordInput}
                                    onChange={(e) => setPasswordInput(e.target.value)}
                                    placeholder="••••"
                                />
                            </div>

                            {errorLogin && (
                                <div className="login-error">
                                    ⚠️ Usuario o contraseña incorrectos.
                                </div>
                            )}

                            <button type="submit" className="btn-login">
                                Iniciar Sesión
                            </button>
                        </form>
                    )}
                </div>
            </div>
        );
    }

    // --- PANTALLA DEL PANEL DE CONTROL ---
    return (
        <div className="admin-container">
            <header className="admin-header">
                <div className="header-top">
                    <div className="brand">
                        <div className="brand-icon">
                            <span className="material-symbols-outlined">store</span>
                        </div>
                        <div className="brand-text">
                            <h2>{nombreNegocio}</h2>
                            <p>Panel de Control • Gestión de Establecimiento</p>
                        </div>
                    </div>

                    <button onClick={cerrarSesion} className="btn-logout" title="Cerrar Sesión">
                        <span className="material-symbols-outlined">logout</span>
                    </button>
                </div>

                <nav className="admin-nav no-scrollbar">
                    <button
                        className={`nav-link ${tabActiva === 'negocio' ? 'active' : ''}`}
                        onClick={() => setTabActiva('negocio')}
                    >
                        Datos del Negocio
                    </button>
                    <button
                        className={`nav-link ${tabActiva === 'mapa' ? 'active' : ''}`}
                        onClick={() => setTabActiva('mapa')}
                    >
                        Diseño Plano
                    </button>
                    <button
                        className={`nav-link ${tabActiva === 'menu' ? 'active' : ''}`}
                        onClick={() => setTabActiva('menu')}
                    >
                        Gestión Menú
                    </button>
                    <button
                        className={`nav-link ${tabActiva === 'pagos' ? 'active' : ''}`}
                        onClick={() => setTabActiva('pagos')}
                    >
                        Configuración Pagos
                    </button>
                </nav>
            </header>

            <main className="admin-main">
                {tabActiva === 'negocio' && (
                    <DatosNegocio
                        nombreActual={nombreNegocio}
                        alGuardarNombre={setNombreNegocio}
                    />
                )}
                {tabActiva === 'mapa' && <MapaEditor />}
                {tabActiva === 'menu' && <MenuEditor />}
                {tabActiva === 'pagos' && <PaymentConfig />}
            </main>
        </div>
    );
}