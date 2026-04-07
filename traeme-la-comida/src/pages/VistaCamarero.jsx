import React, { useState, useEffect } from 'react';
import './VistaCamarero.css';
import { useMesasRealtime } from '../hooks/useMesasRealtime';
import { añadirAComanda, eliminarProductoDelPedido, servirDetalles, cobrarYFinalizarMesa, simularPlatoListo, limpiarAsistencia } from '../services/apiCamarero';
import { getProductosDisponibles } from '../services/apiMenu';
import { loginWithCredenciales } from '../services/apiAuth';

export default function VistaCamarero() {
    // --- ESTADOS DE AUTENTICACIÓN ---
    const [estaAutenticado, setEstaAutenticado] = useState(true);//CAMBIAR POR FALSE DESPUES!
    const [usuarioInput, setUsuarioInput] = useState('');
    const [passwordInput, setPasswordInput] = useState('');
    const [errorLogin, setErrorLogin] = useState(false);

    // --- 1. BASE DE DATOS COMPLETA ---
    const { mesas, salas } = useMesasRealtime();
    const [menuDesayunos, setMenuDesayunos] = useState([]);

    useEffect(() => {
        const fetchMenu = async () => {
            const prods = await getProductosDisponibles();
            setMenuDesayunos(prods);
        };
        fetchMenu();
    }, []);

    // --- 2. ESTADOS DE INTERFAZ ---
    const [salaActivaId, setSalaActivaId] = useState(null);
    const [mesaSeleccionada, setMesaSeleccionada] = useState(null);

    useEffect(() => {
        if (!salaActivaId && salas && salas.length > 0) {
            setSalaActivaId(salas[0].id);
        }
    }, [salas]);

    const mesasMostradas = mesas.filter(m => m.salaId === salaActivaId);

    // --- LÓGICA DE LOGIN ---
    const manejarLogin = async (e) => {
        e.preventDefault();
        const { success } = await loginWithCredenciales(usuarioInput, passwordInput, 'camarero');
        if (success) {
            setEstaAutenticado(true);
            setErrorLogin(false);
        } else {
            setErrorLogin(true);
            setPasswordInput('');
        }
    };

    const cerrarSesion = () => {
        if (window.confirm("¿Seguro que quieres bloquear la terminal de sala?")) {
            setEstaAutenticado(false);
            setUsuarioInput('');
            setPasswordInput('');
        }
    };

    // --- 3. FUNCIONES DE CÁLCULO VISUAL ---
    const calcularEstadoMesa = (mesa) => {
        if (mesa.necesitaCobro) return { bg: '#fecaca', border: '#ef4444', estado: 'cobrar' };
        if (mesa.necesitaAsistencia) return { bg: '#fca5a5', border: '#ef4444', estado: 'asistencia' };

        const tieneListos = mesa.pedido.some(p => p.estadoItem === 'listo');
        if (tieneListos) return { bg: '#fef08a', border: '#eab308', estado: 'servir' };
        const tieneNoServido = mesa.pedido.some(p => p.estadoItem === 'no_servido');
        if (tieneNoServido || mesa.pedido.length > 0) return { bg: '#f1f5f9', border: '#94a3b8', estado: 'ocupada' };
        return { bg: '#ffffff', border: '#cbd5e1', estado: 'libre' };
    };

    const getNotificacionSala = (idSalaBuscada) => {
        const mesasSala = mesas.filter(m => m.salaId === idSalaBuscada);
        const hayCobro = mesasSala.some(m => m.necesitaCobro);
        const hayAsistencia = mesasSala.some(m => m.necesitaAsistencia);
        const hayListo = mesasSala.some(m => m.pedido.some(p => p.estadoItem === 'listo'));

        if (hayCobro || hayAsistencia) return <span className="sala-dot dot-rojo blink-dot"></span>;
        if (hayListo) return <span className="sala-dot dot-amarillo"></span>;
        return null;
    };

    // --- 4. FUNCIONES DE ACCIÓN ---
    const añadirProducto = async (mesa, producto) => {
        try {
            await añadirAComanda(mesa.id, mesa.pedidoId, producto);
        } catch (error) {
            console.error(error);
            alert("Error al añadir a la comanda.");
        }
    };

    const eliminarProducto = async (detalleId) => {
        try {
            await eliminarProductoDelPedido(detalleId);
        } catch (error) {
            console.error(error);
        }
    };

    const servirPlatosListosLocal = async (mesa) => {
        const listosIds = mesa.pedido.filter(p => p.estadoItem === 'listo').map(p => p.idDetalle);
        if (listosIds.length === 0) return;
        try {
            await servirDetalles(listosIds);
        } catch (error) {
            console.error(error);
        }
    };

    const servirPlatoIndividualLocal = async (idDetalle) => {
        try {
            await servirDetalles([idDetalle]);
        } catch (error) {
            console.error(error);
        }
    };

    const cobrarYCerrarMesaLocal = async (mesa) => {
        // 1. Identificar qué productos vamos a cobrar ahora
        // Si hay items con solicitud explícita, cobramos solo esos. Si no, cobramos todo lo pendiente.
        const itemsSolicitados = mesa.pedido.filter(i => i.estadoItem === 'solicitado_mesa');
        const itemsACobrar = itemsSolicitados.length > 0 ? itemsSolicitados : mesa.pedido.filter(i => {
            if (mesa.tipoPedido === 'barra') {
                return i.estadoItem === 'solicitado_mesa' || i.estadoItem === 'no_servido';
            }
            return i.estadoItem !== 'pagado';
        });

        if (itemsACobrar.length === 0) {
            alert("No hay productos pendientes de cobro.");
            return;
        }

        const totalACobrar = itemsACobrar.reduce((t, i) => t + (i.precio * i.cantidad), 0);
        const metodoFinal = mesa.metodoPago || 'Efectivo';

        try {
            // 2. Registrar el pago parcial o total en la tabla de pagos
            // Importamos dinámicamente para no ensuciar la cabecera si no es necesario
            const { registrarPago, actualizarEstadoDetalle } = await import('../services/apiCliente');
            await registrarPago(mesa.pedidoId, totalACobrar, metodoFinal);

            // 3. Marcar los items correspondientes como pagados en la base de datos
            for (const item of itemsACobrar) {
                await actualizarEstadoDetalle(item.idDetalle, 'pagado');
            }

            // 4. Determinar si el pedido debe cerrarse o volver a estado activo
            // Buscamos si en mesa.pedido original (antes de la actualización local de estados que aún no ha ocurrido)
            // quedarán items sin pagar después de esta transacción.
            const pendientesTotales = mesa.pedido.filter(i => i.estadoItem !== 'pagado');
            const quedanPendientesReales = pendientesTotales.some(p => !itemsACobrar.find(a => a.idDetalle === p.idDetalle));

            if (!quedanPendientesReales) {
                // TODO PAGADO: Cerrar pedido y limpiar mesa
                const { fetchApi } = await import('../services/apiClient');
                await fetchApi(`/pedido/${mesa.pedidoId}`, {
                    method: 'PATCH',
                    body: JSON.stringify({
                        estado: 'cerrado',
                        fecha_final: new Date().toISOString()
                    })
                });
                const { generateUuid } = await import('../utils/uuid');
                await fetchApi(`/mesa/${mesa.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ uuid: generateUuid() })
                });
            } else {
                // QUEDAN COSAS: Volver a estado activo (quita la alarma de cobro en el mapa)
                const { fetchApi } = await import('../services/apiClient');
                await fetchApi(`/pedido/${mesa.pedidoId}`, {
                    method: 'PATCH',
                    body: JSON.stringify({
                        estado: 'activo'
                    })
                });
            }

            setMesaSeleccionada(null);
        } catch (error) {
            console.error("Error en cobro granular:", error);
            alert("Hubo un error al procesar el cobro.");
        }
    };

    const simularPlatoListoLocal = async (detalleId) => {
        try {
            await simularPlatoListo(detalleId);
        } catch (error) {
            console.error(error);
        }
    };

    const cambiarSala = (salaId) => {
        setSalaActivaId(salaId);
        setMesaSeleccionada(null);
    };

    const mesaActiva = mesaSeleccionada ? mesas.find(m => m.id === mesaSeleccionada.id) : null;

    // --- PANTALLA DE LOGIN ---
    if (!estaAutenticado) {
        return (
            <div className="camarero-login-container">
                <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap" rel="stylesheet" />
                <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet" />

                <div className="camarero-login-box">
                    <div className="camarero-login-header">
                        <span className="material-symbols-outlined login-icon">restaurant</span>
                        <h2>Terminal de Sala</h2>
                        <p>Identifícate para abrir el plano de mesas</p>
                    </div>

                    <form onSubmit={manejarLogin} className="camarero-login-form">
                        <div className="form-group">
                            <label>USUARIO</label>
                            <input
                                type="text"
                                value={usuarioInput}
                                onChange={(e) => setUsuarioInput(e.target.value)}
                                placeholder="Ej: usuario"
                                autoFocus
                            />
                        </div>

                        <div className="form-group">
                            <label>CONTRASEÑA</label>
                            <input
                                type="password"
                                value={passwordInput}
                                onChange={(e) => setPasswordInput(e.target.value)}
                                placeholder="••••"
                            />
                        </div>

                        {errorLogin && (
                            <div className="camarero-login-error">
                                ⚠️ Credenciales incorrectas
                            </div>
                        )}

                        <button type="submit" className="camarero-btn-login">
                            ACCEDER
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // --- PANTALLA PRINCIPAL (CAMARERO) ---
    return (
        <div className="vista-camarero">
            <div className="layout-izquierdo">

                {/* CABECERA Y PESTAÑAS (Con botón de cerrar sesión) */}
                <div className="camarero-header-top">
                    <div className="tabs-salas">
                        {salas && salas.map(sala => (
                            <button
                                key={sala.id}
                                className={`tab-sala ${salaActivaId === sala.id ? 'active' : ''}`}
                                onClick={() => cambiarSala(sala.id)}
                            >
                                {sala.nombre}
                                {getNotificacionSala(sala.id)}
                            </button>
                        ))}
                    </div>

                    <button onClick={cerrarSesion} className="btn-logout-camarero" title="Bloquear Terminal">
                        <span className="material-symbols-outlined">lock</span> Bloquear
                    </button>
                </div>

                <div className="mapa-container">
                    <div className="mapa-scroll-area">
                        {mesasMostradas.map(mesa => {
                            const styleInfo = calcularEstadoMesa(mesa);
                            return (
                                <div
                                    key={mesa.id}
                                    className={`mesa-item ${styleInfo.estado === 'cobrar' ? 'blink-border' : ''}`}
                                    style={{
                                        left: mesa.x, top: mesa.y, width: mesa.w, height: mesa.h,
                                        backgroundColor: styleInfo.bg,
                                        border: `2px solid ${styleInfo.border}`
                                    }}
                                    onClick={() => setMesaSeleccionada(mesa)}
                                >
                                    {styleInfo.estado === 'cobrar' && (
                                        <div className="badge-notificacion badge-rojo">
                                            {mesa.metodoPago?.toLowerCase()?.includes('tarjeta') || mesa.metodoPago === 'card' ? '💳' :
                                                mesa.metodoPago?.toLowerCase() === 'bizum' ? '📱' :
                                                    (mesa.metodoPago?.toLowerCase()?.includes('google') || mesa.metodoPago?.toLowerCase()?.includes('gpay')) ? '🤖' : '💶'}
                                        </div>
                                    )}
                                    {styleInfo.estado === 'asistencia' && (
                                        <div className="badge-notificacion badge-rojo">🛎️</div>
                                    )}
                                    {styleInfo.estado === 'servir' && !mesa.necesitaCobro && (
                                        <div className="badge-notificacion badge-amarillo">🍽️</div>
                                    )}

                                    <span className="mesa-numero">{mesa.numero}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* PANEL DETALLE */}
            {mesaActiva && (
                <div className="panel-detalle">
                    <button className="btn-close-panel" onClick={() => setMesaSeleccionada(null)}>✕</button>

                    <div className="panel-header">
                        <h2>{mesaActiva.numero === 'Barra' ? 'Servicio de Barra' : `Mesa ${mesaActiva.numero}`}</h2>
                        {mesaActiva.necesitaCobro && (
                            <div className="alerta-cobro">
                                Pagar con {
                                    (mesaActiva.metodoPago?.toLowerCase()?.includes('tarjeta') || mesaActiva.metodoPago === 'card') ? '💳 TARJETA' :
                                        mesaActiva.metodoPago?.toLowerCase() === 'bizum' ? '📱 BIZUM' :
                                            (mesaActiva.metodoPago?.toLowerCase()?.includes('google') || mesaActiva.metodoPago?.toLowerCase()?.includes('gpay')) ? '🤖 GOOGLE PAY' : '💶 EFECTIVO'
                                }
                            </div>
                        )}
                    </div>

                    <div className="lista-comanda">
                        {mesaActiva.pedido.filter(item => item.estadoItem !== 'servido' && item.estadoItem !== 'pagado').map((item, idx) => (
                            <div key={idx} className={`comanda-item estado-${item.estadoItem}`}>
                                <div className="info-prod">
                                    {mesaActiva.tipoPedido === 'barra' && item.numeroPedido && (
                                        <span className="badge-pedido">#{item.numeroPedido}</span>
                                    )}
                                    <span className="cant">{item.cantidad}x</span>
                                    <span className="nom" style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span>
                                            {item.nombre}
                                            {mesaActiva.tipoPedido === 'barra' && (item.estadoItem === 'listo' || item.estadoItem === 'preparando') && <small style={{ color: '#34a853', marginLeft: '5px', fontWeight: 'bold' }}>PAGADO</small>}
                                            {item.estadoItem === 'listo' && <small className="tag-listo">LISTO</small>}
                                            {item.estadoItem === 'no_servido' && <small className="tag-prep">En prep...</small>}
                                        </span>
                                        {item.notas && <small style={{ color: '#64748b', fontSize: '11px', fontStyle: 'italic' }}>{item.notas}</small>}
                                    </span>
                                </div>
                                <div className="precio-del">
                                    {item.estadoItem === 'listo' && (
                                        <button className="btn-servir-ind" onClick={() => servirPlatoIndividualLocal(item.idDetalle)}>
                                            Entregar
                                        </button>
                                    )}
                                    <span className="subtotal">{(item.precio * item.cantidad).toFixed(2)}€</span>
                                    <button className="btn-del-x" onClick={() => eliminarProducto(item.idDetalle)}>✖</button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="añadir-productos">
                        <select onChange={(e) => {
                            if (e.target.value) {
                                añadirProducto(mesaActiva, menuDesayunos.find(p => p.id === parseInt(e.target.value)));
                                e.target.value = "";
                            }
                        }}>
                            <option value="">+ Añadir pedido presencial...</option>
                            {menuDesayunos.map(prod => <option key={prod.id} value={prod.id}>{prod.nombre} - {prod.precio.toFixed(2)}€</option>)}
                        </select>
                    </div>

                    {mesaActiva.pedido.some(p => p.estadoItem === 'no_servido') && (
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                            {mesaActiva.pedido.filter(p => p.estadoItem === 'no_servido').map(p => (
                                <button key={p.idDetalle} style={{ margin: '5px 0', padding: '5px', background: '#f8fafc', border: '1px dashed #cbd5e1', cursor: 'pointer', borderRadius: '4px' }} onClick={() => simularPlatoListoLocal(p.idDetalle)}>
                                    🛠️ [DEV] Listo: {p.nombre}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="panel-footer">
                        <div className="total-box">
                            <span>TOTAL</span>
                            <span>{mesaActiva.pedido.filter(i => {
                                if (mesaActiva.tipoPedido === 'barra') {
                                    return i.estadoItem === 'solicitado_mesa' || i.estadoItem === 'no_servido';
                                }
                                return i.estadoItem !== 'pagado';
                            }).reduce((t, i) => t + (i.precio * i.cantidad), 0).toFixed(2)}€</span>
                        </div>

                        <div className="acciones-mesa">
                            {mesaActiva.necesitaAsistencia && (
                                <button className="btn-accion btn-servir" style={{ backgroundColor: '#eab308' }} onClick={async () => {
                                    await limpiarAsistencia(mesaActiva.id);
                                    // Actualización optimista
                                    setMesaSeleccionada({ ...mesaActiva, necesitaAsistencia: false });
                                }}>
                                    🛎️ Atendida
                                </button>
                            )}

                            {mesaActiva.pedido.some(p => p.estadoItem === 'listo') && mesaActiva.tipoPedido !== 'barra' && (
                                <button className="btn-accion btn-servir" onClick={() => servirPlatosListosLocal(mesaActiva)}>
                                    🍽️ Servir todos los platos
                                </button>
                            )}

                            {mesaActiva.necesitaCobro && (
                                <button className="btn-accion btn-cobrar" onClick={() => cobrarYCerrarMesaLocal(mesaActiva)}>
                                    ✅ Cobrar
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}