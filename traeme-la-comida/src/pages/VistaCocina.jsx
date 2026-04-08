import React, { useState, useEffect } from 'react';
import './VistaCocina.css';
import { loginWithCredenciales } from '../services/apiAuth';
import { useCocinaRealtime } from '../hooks/useCocinaRealtime';
import { actualizarEstadoDetalle, marcarProductoAgotado, marcarProductoDisponible } from '../services/apiCocina';
import { getMenuCompletoAdmin } from '../services/apiMenuManager';
import { voiceService } from '../services/voiceService';
import { useTranslation } from 'react-i18next';

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
    const [estadoVoz, setEstadoVoz] = useState(null); // null, 'grabando', 'procesando'
    const [ultimoComando, setUltimoComando] = useState("");
    const { t } = useTranslation();

    const [menuData, setMenuData] = useState([]);
    const [modalBloquearStock, setModalBloquearStock] = useState(false);
    const [filtroStock, setFiltroStock] = useState("");

    useEffect(() => {
        const timer = setInterval(() => setHora(new Date().toLocaleTimeString()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const fetchMenu = async () => {
            const dataMenu = await getMenuCompletoAdmin();
            setMenuData(dataMenu || []);
        };
        fetchMenu();
    }, []);

    // Limpiar la barra lateral de "Listos" cuando el camarero los sirve y desaparecen de pedidos activos
    useEffect(() => {
        setCompletados(prev => prev.filter(c => pedidos.some(p => p.idPedido === c.id)));
    }, [pedidos]);

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

        // Flow: no_servido/pagado/solicitado_mesa -> listo
        let nuevoEstado = 'listo';
        if (itemActual.estado === 'listo') nuevoEstado = 'no_servido'; // Toggle back if needed

        try {
            await actualizarEstadoDetalle(itemActual.idDetalle, nuevoEstado);
            
            const todosListos = pedido.items.every((item, idx) => 
                idx === itemIndex ? nuevoEstado === 'listo' : item.estado === 'listo'
            );
            
            if (todosListos) {
                setCompletados(prev => [{ id: pedido.idPedido, mesa: pedido.mesaStr, resumen: `Resuelto a las ${new Date().toLocaleTimeString()}` }, ...prev]);
            }
            
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
    const marcarComoAgotadoLocal = async (nombreProducto) => {
        const ingredienteLimpio = nombreProducto.trim();
        if (!ingredienteLimpio) return;

        try {
            await marcarProductoAgotado(ingredienteLimpio);
            
            // Actualizar estado local del menú
            setMenuData(prev => prev.map(cat => ({
                ...cat,
                productos: cat.productos.map(p => 
                    p.nombre.toLowerCase() === ingredienteLimpio.toLowerCase() 
                    ? { ...p, disponible: false } 
                    : p
                )
            })));

            setUltimoComando(`¡${ingredienteLimpio.toUpperCase()} bloqueado!`);
        } catch (error) {
            console.error(error);
            setUltimoComando(`Error al bloquear ${ingredienteLimpio}`);
        }
        setTimeout(() => setUltimoComando(""), 4000);
    };

    const reponerProductoLocal = async (nombreProducto) => {
        const ingredienteLimpio = nombreProducto.trim();
        if (!ingredienteLimpio) return;

        try {
            await marcarProductoDisponible(ingredienteLimpio);
            
            // Actualizar estado local del menú
            setMenuData(prev => prev.map(cat => ({
                ...cat,
                productos: cat.productos.map(p => 
                    p.nombre.toLowerCase() === ingredienteLimpio.toLowerCase() 
                    ? { ...p, disponible: true } 
                    : p
                )
            })));

            setUltimoComando(`¡${ingredienteLimpio.toUpperCase()} repuesto!`);
        } catch (error) {
            console.error(error);
            setUltimoComando(`Error al reponer ${ingredienteLimpio}`);
        }
        setTimeout(() => setUltimoComando(""), 4000);
    };

    const abrirModalStock = () => {
        setModalBloquearStock(true);
        setFiltroStock("");
    };

    const restaurarStockLocal = (ingredienteLimpio) => {
        if (window.confirm(`¿El producto "${ingredienteLimpio}" vuelve a estar disponible? Ve a Ajustes > Carta para revisarlo de forma permanente, por ahora lo quito de esta lista visual.`)) {
            setProductosAgotados(prev => prev.filter(item => item !== ingredienteLimpio));

            setUltimoComando(`¡Aviso visual de ${ingredienteLimpio} quitado! (Para volver a activarlo, entra al Menu Editor de Admin)`);
            setTimeout(() => setUltimoComando(""), 4000);
        }
    };

    // --- LÓGICA DE RECONOCIMIENTO DE VOZ ASISTIDA POR IA ---
    const manejarVoz = async () => {
        if (estadoVoz === 'grabando') {
            detenerYProcesarVoz();
        } else {
            iniciarGrabacion();
        }
    };

    const iniciarGrabacion = async () => {
        try {
            await voiceService.startRecording();
            setEstadoVoz('grabando');
            setUltimoComando("Escuchando comando...");
        } catch (err) {
            console.error("Error al grabar:", err);
            setUltimoComando("Error al acceder al micrófono");
            setTimeout(() => setUltimoComando(""), 3000);
        }
    };

    const detenerYProcesarVoz = async () => {
        try {
            setEstadoVoz('procesando');
            setUltimoComando("Procesando comando con IA...");
            
            const blob = await voiceService.stopRecording();
            const transcript = await voiceService.transcribe(blob);
            
            if (!transcript) {
                setEstadoVoz(null);
                setUltimoComando("No se escuchó nada");
                return;
            }

            const command = await voiceService.parseKitchenCommand(transcript, menuData, pedidos);
            
            if (command.action === 'COMPLETE_ORDER') {
                const idPedido = parseInt(command.targetId);
                const pedidoObj = pedidos.find(p => p.idPedido === idPedido);
                if (pedidoObj) {
                    await finalizarPedidoLocal(pedidoObj);
                    setUltimoComando(`¡Pedido #${idPedido} completado!`);
                } else {
                    setUltimoComando(`Error: Pedido #${idPedido} no está activo`);
                }
            } 
            else if (command.action === 'OUT_OF_STOCK') {
                const prodId = command.targetId;
                // Buscamos el nombre del producto por su ID en menuData
                let nombreProd = "";
                menuData.forEach(cat => {
                    const p = cat.productos.find(pr => pr.id === prodId);
                    if (p) nombreProd = p.nombre;
                });

                if (nombreProd) {
                    await marcarComoAgotadoLocal(nombreProd);
                    setUltimoComando(`¡${nombreProd} marcado como AGOTADO!`);
                } else {
                    setUltimoComando("Error: Producto no identificado");
                }
            } 
            else if (command.action === 'RESTOCK_PRODUCT') {
                const prodId = command.targetId;
                let nombreProd = "";
                menuData.forEach(cat => {
                    const p = cat.productos.find(pr => pr.id === prodId);
                    if (p) nombreProd = p.nombre;
                });

                if (nombreProd) {
                    await reponerProductoLocal(nombreProd);
                } else {
                    setUltimoComando("Error: Producto no identificado");
                }
            }
            else {
                setUltimoComando(`No entendí el comando: "${transcript}"`);
            }

            setEstadoVoz(null);
            setTimeout(() => setUltimoComando(""), 4000);

        } catch (err) {
            console.error("Error procesando voz en cocina:", err);
            setEstadoVoz(null);
            setUltimoComando("Error en el servidor de IA");
            setTimeout(() => setUltimoComando(""), 3000);
        }
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
                        </div>
                    </div>
                </div>
                <div className="vcoc-header-right">
                    {/* NUEVO BOTÓN MANUAL DE STOCK */}
                    <button onClick={abrirModalStock} className="vcoc-btn-manual" title="Control de disponibilidad de productos">
                        <span className="material-symbols-outlined">inventory_2</span>
                        CONTROL DE STOCK
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
                            pedidos.filter(p => p.items.some(i => i.estado !== 'listo' && i.estado !== 'servido')).map(p => {
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
                                            {/* En la tarjeta solo mostramos lo que NO esté listo ni servido */}
                                            {p.items.filter(i => i.estado !== 'listo' && i.estado !== 'servido').map((item, idx) => (
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
                    <button 
                        className={`vcoc-btn-voz ${estadoVoz === 'grabando' ? 'grabando' : ''} ${estadoVoz === 'procesando' ? 'procesando' : ''}`} 
                        onClick={manejarVoz}
                        disabled={estadoVoz === 'procesando'}
                    >
                        <span className="material-symbols-outlined">
                            {estadoVoz === 'grabando' ? 'stop_circle' : (estadoVoz === 'procesando' ? 'sync' : 'mic')}
                        </span>
                        <div className="vcoc-voz-text">
                            <div className="voz-title">
                                {estadoVoz === 'grabando' ? "PULSA PARA TERMINAR" : (estadoVoz === 'procesando' ? "PROCESANDO CON IA..." : "ASISTENTE DE COCINA")}
                            </div>
                            <div className="voz-subtitle">EJ: "PEDIDO 501 LISTO", "AGOTADO CAFÉ" o "CAFÉ REPUESTO"</div>
                        </div>
                    </button>
                </div>

                <div className="vcoc-footer-right">
                    <div className="vcoc-clock">{hora}</div>
                </div>
            </footer>

            {/* MODAL DE BLOQUEAR STOCK */}
            {modalBloquearStock && (
                <div 
                    onClick={() => setModalBloquearStock(false)}
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                >
                    <div 
                        onClick={e => e.stopPropagation()} 
                        style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '12px', width: '90%', maxWidth: '500px', color: 'white', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h2 style={{ margin: 0 }}>Bloquear Producto</h2>
                            <button onClick={() => setModalBloquearStock(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '24px' }}>✕</button>
                        </div>
                        <input 
                            type="text" 
                            placeholder="Buscar producto..." 
                            value={filtroStock}
                            onChange={e => setFiltroStock(e.target.value)}
                            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#0f172a', color: 'white', marginBottom: '15px', fontSize: '16px', boxSizing: 'border-box' }}
                            autoFocus
                        />
                        <div style={{ overflowY: 'auto', paddingRight: '10px' }}>
                            {menuData.flatMap(cat => cat.productos).filter(p => p.nombre.toLowerCase().includes(filtroStock.toLowerCase())).map(prod => {
                                const isBloqueado = !prod.disponible;
                                return (
                                    <div 
                                        key={prod.id} 
                                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderBottom: '1px solid #334155', borderRadius: '8px', transition: 'background 0.2s' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                            <img src={prod.img} alt="" style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover', opacity: isBloqueado ? 0.4 : 1 }} />
                                            <div>
                                                <div style={{ fontWeight: 'bold', color: isBloqueado ? '#94a3b8' : 'white' }}>{prod.nombre}</div>
                                                <div style={{ fontSize: '11px', color: isBloqueado ? '#ef4444' : '#22c55e', fontWeight: '800' }}>
                                                    {isBloqueado ? 'AGOTADO' : 'DISPONIBLE'}
                                                </div>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                if (isBloqueado) reponerProductoLocal(prod.nombre);
                                                else marcarComoAgotadoLocal(prod.nombre);
                                            }}
                                            style={{ 
                                                backgroundColor: isBloqueado ? '#22c55e' : '#ef4444', 
                                                color: 'white', 
                                                border: 'none', 
                                                padding: '8px 16px', 
                                                borderRadius: '6px', 
                                                cursor: 'pointer', 
                                                fontWeight: 'bold',
                                                minWidth: '110px'
                                            }}
                                        >
                                            {isBloqueado ? 'REPONER' : 'AGOTAR'}
                                        </button>
                                    </div>
                                );
                            })}
                            {menuData.flatMap(cat => cat.productos).filter(p => p.nombre.toLowerCase().includes(filtroStock.toLowerCase())).length === 0 && (
                                <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>No se encontraron productos.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VistaCocina;