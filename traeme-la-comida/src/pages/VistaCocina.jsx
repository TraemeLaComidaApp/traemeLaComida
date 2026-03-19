import React, { useState, useEffect } from 'react';
import './VistaCocina.css';
import { loginWithCredenciales } from '../services/apiAuth';
import { useCocinaRealtime } from '../hooks/useCocinaRealtime';
import { actualizarEstadoDetalle, marcarProductoAgotado } from '../services/apiCocina';

const VistaCocina = () => {
    // --- ESTADOS DE AUTENTICACIÓN ---
    const [estaAutenticado, setEstaAutenticado] = useState(true); //CAMBIAR POR FALSE DESPUES!
    const [usuarioInput, setUsuarioInput] = useState('');
    const [passwordInput, setPasswordInput] = useState('');
    const [errorLogin, setErrorLogin] = useState(false);

    // --- ESTADOS DE LA COCINA ---
    const [vista, setVista] = useState('grid');
    const { pedidos, cargarPedidos, cargando } = useCocinaRealtime();

    const [completados, setCompletados] = useState([]);
    const [productosAgotados, setProductosAgotados] = useState([]);
    const [hora, setHora] = useState(new Date().toLocaleTimeString());
    const [escuchando, setEscuchando] = useState(false);
    const [ultimoComando, setUltimoComando] = useState("");

    useEffect(() => {
        const timer = setInterval(() => setHora(new Date().toLocaleTimeString()), 1000);
        return () => clearInterval(timer);
    }, []);

    // --- LÓGICA DE LOGIN ---
    const manejarLogin = async (e) => {
        e.preventDefault();
        const { success } = await loginWithCredenciales(usuarioInput, passwordInput, 'cocina');
        if (success) {
            setEstaAutenticado(true);
            setErrorLogin(false);
        } else {
            setErrorLogin(true);
            setPasswordInput('');
        }
    };

    const cerrarSesion = () => {
        if (window.confirm("¿Seguro que quieres bloquear la pantalla de cocina?")) {
            setEstaAutenticado(false);
            setUsuarioInput('');
            setPasswordInput('');
        }
    };

    // --- LÓGICA DE PEDIDOS A BASE DE DATOS ---
    const toggleItem = async (pedidoId, itemIndex) => {
        const pedido = pedidos.find(p => p.idPedido === pedidoId);
        if (!pedido) return;

        const itemActual = pedido.items[itemIndex];
        if (itemActual.estado === 'agotado') return;

        // Flow: no_servido -> listo
        let nuevoEstado = 'no_servido';
        if (itemActual.estado === 'no_servido') nuevoEstado = 'listo';
        else if (itemActual.estado === 'listo') nuevoEstado = 'no_servido'; // Toggle back if needed

        try {
            await actualizarEstadoDetalle(itemActual.idDetalle, nuevoEstado);
            cargarPedidos(); // Refrescar 
        } catch (error) {
            console.error("Error toggling item", error);
        }
    };

    const finalizarPedidoLocal = async (pedido) => {
        // En un mundo ideal, la cocina dice "Terminé de preparar TODO el pedido". 
        // Actualizamos todos los detalles pendientes/preparando a 'listo'
        const detallesIds = pedido.items.filter(i => i.estado !== 'listo').map(i => i.idDetalle);
        try {
            for (let id of detallesIds) {
                await actualizarEstadoDetalle(id, 'listo');
            }
            setCompletados([{ id: pedido.idPedido, mesa: pedido.mesaStr, resumen: `Resuelto a las ${hora}` }, ...completados]);
            cargarPedidos(); // Re-fetch, este pedido debería desaparecer del KDS si todos sus items están en Listos y la query deja de atraer cosas listas solas (o lo limpiamos aquí)
        } catch (error) {
            console.error("Error finalizando pedido completo", error);
        }
    };

    // --- LÓGICA DE STOCK (Manual y DB) ---
    const marcarComoAgotadoLocal = async (ingrediente) => {
        const ingredienteLimpio = ingrediente.trim().toUpperCase();
        if (!ingredienteLimpio) return;

        try {
            await marcarProductoAgotado(ingredienteLimpio);
            setProductosAgotados(prev => {
                if (!prev.includes(ingredienteLimpio)) return [...prev, ingredienteLimpio];
                return prev;
            });
            setUltimoComando(`¡${ingredienteLimpio} bloqueado en TPV! (Verificado en DB)`);
            cargarPedidos();
        } catch (error) {
            console.error(error);
            setUltimoComando(`Error al bloquear ${ingredienteLimpio}`);
        }

        setTimeout(() => setUltimoComando(""), 4000);
    };

    const marcarAgotadoManual = () => {
        const producto = window.prompt("Escribe el nombre EXTRACTO o COMÚN de la carta que está agotado (Ej: Aguacate, Croissant, Mantequilla):");
        if (producto && producto.trim() !== "") {
            marcarComoAgotadoLocal(producto);
        }
    };

    const restaurarStockLocal = (ingredienteLimpio) => {
        if (window.confirm(`¿El producto "${ingredienteLimpio}" vuelve a estar disponible? Ve a Ajustes > Carta para revisarlo de forma permanente, por ahora lo quito de esta lista visual.`)) {
            setProductosAgotados(prev => prev.filter(item => item !== ingredienteLimpio));

            setUltimoComando(`¡Aviso visual de ${ingredienteLimpio} quitado! (Para volver a activarlo, entra al Menu Editor de Admin)`);
            setTimeout(() => setUltimoComando(""), 4000);
        }
    };

    // --- LÓGICA DE RECONOCIMIENTO DE VOZ ---
    const iniciarReconocimientoVoz = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Tu navegador no soporta comandos de voz. Prueba a usar Google Chrome.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'es-ES';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            setEscuchando(true);
            setUltimoComando("Escuchando...");
        };

        recognition.onresult = (event) => {
            const comando = event.results[0][0].transcript.toLowerCase();

            if (comando.includes("completar") || comando.includes("listo") || comando.includes("pedido")) {
                const numerosMatch = comando.match(/\d+/);
                if (numerosMatch) {
                    const idBuscado = numerosMatch[0];
                    const pedidoEncontrado = pedidos.find(p => p.idPedido === parseInt(idBuscado));
                    if (pedidoEncontrado) {
                        finalizarPedidoLocal(pedidoEncontrado);
                        setUltimoComando(`Pedido ${idBuscado} completado`);
                    } else {
                        setUltimoComando(`Error: Pedido ${idBuscado} no encontrado`);
                    }
                } else {
                    setUltimoComando(`No entendí el número. Dijiste: "${comando}"`);
                }
            }
            else if (comando.includes("agotado") || comando.includes("sin stock") || comando.includes("no queda")) {
                let productoStr = comando.replace(/.*(agotado|sin stock|no queda)\s+/i, '').trim();
                productoStr = productoStr.replace(/^(el|la|los|las|un|una)\s+/i, '');

                if (productoStr) {
                    marcarComoAgotadoLocal(productoStr);
                } else {
                    setUltimoComando("Dime qué se ha agotado. Ej: 'Agotado croissant'");
                }
            }
            else {
                setUltimoComando(`Comando desconocido: "${comando}"`);
            }
        };

        recognition.onerror = () => {
            setEscuchando(false);
            setUltimoComando("Error al escuchar. Intenta de nuevo.");
            setTimeout(() => setUltimoComando(""), 4000);
        };

        recognition.onend = () => {
            setEscuchando(false);
            setTimeout(() => setUltimoComando(""), 4000);
        };

        recognition.start();
    };

    // --- PANTALLA DE LOGIN ---
    if (!estaAutenticado) {
        return (
            <div className="vcoc-login-container">
                <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@700;900&family=Inter:wght@400;700;800;900&display=swap" rel="stylesheet" />
                <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet" />

                <div className="vcoc-login-box">
                    <div className="vcoc-login-header">
                        <span className="material-symbols-outlined login-icon">precision_manufacturing</span>
                        <h2>KDS TERMINAL</h2>
                        <p>ACCESO RESTRINGIDO A PERSONAL</p>
                    </div>

                    <form onSubmit={manejarLogin} className="vcoc-login-form">
                        <div className="form-group">
                            <label>USUARIO</label>
                            <input
                                type="text"
                                value={usuarioInput}
                                onChange={(e) => setUsuarioInput(e.target.value)}
                                placeholder="ID de Empleado"
                                autoFocus
                            />
                        </div>

                        <div className="form-group">
                            <label>CONTRASEÑA</label>
                            <input
                                type="password"
                                value={passwordInput}
                                onChange={(e) => setPasswordInput(e.target.value)}
                                placeholder="PIN de Acceso"
                            />
                        </div>

                        {errorLogin && (
                            <div className="vcoc-login-error">
                                ⚠️ ACCESO DENEGADO
                            </div>
                        )}

                        <button type="submit" className="vcoc-btn-login">
                            DESBLOQUEAR TERMINAL
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // --- PANTALLA PRINCIPAL DE COCINA ---
    return (
        <div className="vcoc-screen">
            <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@700;900&family=Inter:wght@400;700;800;900&display=swap" rel="stylesheet" />
            <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet" />

            {/* HEADER PRINCIPAL */}
            <header className="vcoc-header">
                <div className="vcoc-header-left">
                    <span className="material-symbols-outlined icon-logo">precision_manufacturing</span>
                    <div>
                        <h1>KDS <span>TABLET-PRO</span></h1>
                        <div className="vcoc-station">
                            ESTACIÓN #01
                            {productosAgotados.length > 0 && (
                                <span className="agotados-badge">
                                    🔴 AGOTADOS:
                                    {productosAgotados.map((prod, idx) => (
                                        <span key={idx} className="agotado-tag" onClick={() => restaurarStockLocal(prod)} title="Clic para restaurar/quitar de la lista visual (permanente en Ajustes)">
                                            {prod}{idx < productosAgotados.length - 1 ? ", " : ""}
                                        </span>
                                    ))}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="vcoc-header-right">
                    {/* NUEVO BOTÓN MANUAL DE STOCK */}
                    <button onClick={marcarAgotadoManual} className="vcoc-btn-manual" title="Marcar producto como agotado manualmente">
                        <span className="material-symbols-outlined">block</span>
                        BLOQUEAR STOCK
                    </button>

                    <div className="vcoc-stats">
                        <div className="stats-label">PROMEDIO PREP.</div>
                        <div className="stats-value caution">08:42</div>
                    </div>
                    <div className="vcoc-sync">
                        <div className="sync-label">SINCRO</div>
                        <div className="sync-value">100%</div>
                    </div>

                    {/* Botón de cerrar sesión integrado en el Header */}
                    <button onClick={cerrarSesion} className="vcoc-btn-logout" title="Bloquear Terminal">
                        <span className="material-symbols-outlined">lock</span>
                    </button>
                </div>
            </header>

            <main className="vcoc-main">
                <section className="vcoc-contentArea">
                    <div className="vcoc-contentHeader">
                        <h2>Pedidos en curso</h2>
                        {ultimoComando && <div className="comando-toast">{ultimoComando}</div>}
                        <div className="vcoc-toggle-group">
                            <button className={`vcoc-toggle-btn ${vista === 'grid' ? 'active' : ''}`} onClick={() => setVista('grid')}>
                                Cuadrícula
                            </button>
                            <button className={`vcoc-toggle-btn ${vista === 'list' ? 'active' : ''}`} onClick={() => setVista('list')}>
                                Lista
                            </button>
                        </div>
                    </div>

                    <div className={`vcoc-pedidos-container ${vista === 'grid' ? 'grid-view' : 'list-view'}`}>
                        {cargando ? (
                            <div style={{ padding: '20px', color: '#fff' }}>Cargando pedidos en tiempo real...</div>
                        ) : pedidos.length === 0 ? (
                            <div style={{ padding: '20px', color: '#888' }}>No hay pedidos en curso. Buen trabajo.</div>
                        ) : (
                            pedidos.filter(p => p.items.some(i => i.estado !== 'listo')).map(p => {
                                // Determinamos retraso simple (> 10 mins)
                                const minsTranscurridos = (new Date() - p.fecha) / 60000;
                                const retraso = minsTranscurridos > 10;

                                return (
                                    <div key={p.idPedido} className={`vcoc-card ${retraso ? 'retraso' : ''} ${vista}`}>
                                        <div className="vcoc-card-header">
                                            <div className="vcoc-card-id">#{p.idPedido}</div>
                                            <div className="vcoc-card-mesa">{p.mesaStr}</div>
                                            <div className="vcoc-card-tiempo">{p.fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                        </div>

                                        <div className="vcoc-card-items">
                                            {/* En la tarjeta solo mostramos lo que NO esté listo */}
                                            {p.items.filter(i => i.estado !== 'listo').map((item, idx) => (
                                                <div key={item.idDetalle} onClick={() => toggleItem(p.idPedido, idx)} className={`vcoc-item vcoc-estado-${item.estado}`}>
                                                    <div className="vcoc-checkbox">
                                                        {item.estado === 'listo' && <span className="material-symbols-outlined">check</span>}
                                                        {item.estado === 'no_servido' && <span className="material-symbols-outlined" style={{ color: '#ffc107' }}>outdoor_grill</span>}
                                                    </div>
                                                    <div className="vcoc-item-details">
                                                        <div className="vcoc-item-name">{item.cantidad}x {item.nombre}</div>
                                                        {item.notas && (
                                                            <div className="vcoc-item-nota">{item.notas}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="vcoc-card-action">
                                            <button onClick={() => finalizarPedidoLocal(p)} className="vcoc-btn-completar">
                                                COMPLETAR TODO EL TICKET
                                            </button>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </section>

                <aside className="vcoc-aside">
                    <div className="vcoc-aside-header">
                        <h2>LISTOS PARA SERVIR</h2>
                    </div>
                    <div className="vcoc-aside-list">
                        {completados.map(c => (
                            <div key={c.id} className="vcoc-completado-item">
                                <div className="vcoc-completado-top">
                                    <b>#{c.id}</b>
                                    <span>{c.mesa}</span>
                                </div>
                                <div className="vcoc-completado-desc">{c.resumen}</div>
                            </div>
                        ))}
                    </div>
                </aside>
            </main>

            <footer className="vcoc-footer">
                <div className="vcoc-footer-left">
                    <button className={`vcoc-btn-voz ${escuchando ? 'escuchando' : ''}`} onClick={iniciarReconocimientoVoz}>
                        <span className="material-symbols-outlined">mic</span>
                        <div className="vcoc-voz-text">
                            <div className="voz-title">{escuchando ? "ESCUCHANDO..." : "ASISTENTE DE VOZ KDS"}</div>
                            <div className="voz-subtitle">EJ: "COMPLETAR 501" o "AGOTADO AGUACATE"</div>
                        </div>
                    </button>
                </div>

                <div className="vcoc-footer-right">
                    <div className="vcoc-clock">{hora}</div>
                </div>
            </footer>
        </div>
    );
};

export default VistaCocina;