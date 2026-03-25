import React, { useState, useEffect } from 'react';
import './VistaBarra.css';
import { getMenuCliente } from '../services/apiMenuManager';
import { 
    submitOrder, 
    getMesaByUuid, 
    getPedidoActivo, 
    getDetallesPedido, 
    registrarPago,
    actualizarEstadoDetalle 
} from '../services/apiCliente';
import { fetchApi } from '../services/apiClient';
import { getConfiguracionLocal } from '../services/apiAuth';
import { useParams } from 'react-router-dom';

const VistaBarra = () => {
    const [seccionActiva, setSeccionActiva] = useState('menu');
    const [filtroActivo, setFiltroActivo] = useState('Todo');
    const [carrito, setCarrito] = useState([]);
    const [metodoPagoMesa, setMetodoPagoMesa] = useState('cash');
    const [pagoSolicitado, setPagoSolicitado] = useState(false);
    const [esperandoCobro, setEsperandoCobro] = useState(false);
    const [numeroPedido, setNumeroPedido] = useState(null);

    const { uuid } = useParams();
    const [idMesaBarra, setIdMesaBarra] = useState(null);

    const [productoModal, setProductoModal] = useState(null);
    const [opcionesElegidas, setOpcionesElegidas] = useState({});
    const [notaOpcional, setNotaOpcional] = useState("");

    const [estadoVoz, setEstadoVoz] = useState(null);
    const [mensajeVoz, setMensajeVoz] = useState("");

    const [menuData, setMenuData] = useState([]);
    const [cargandoMenu, setCargandoMenu] = useState(true);

    const [configNegocio, setConfigNegocio] = useState({ nombre_local: 'Cargando...', logo_url: null });

    useEffect(() => {
        const resolveBarra = async () => {
            try {
                if (uuid) {
                    const data = await getMesaByUuid(uuid);
                    const mesaValida = Array.isArray(data) ? data[0] : (data.data || data);
                    if (mesaValida && mesaValida.id) setIdMesaBarra(mesaValida.id);
                } else {
                    const mesas = await fetchApi('/mesa') || [];
                    const primerBarra = mesas.find(m => m.tipo === 'barra');
                    if (primerBarra) setIdMesaBarra(primerBarra.id);
                    else if (mesas.length > 0) setIdMesaBarra(mesas[0].id);
                }
            } catch (error) {
                console.error("Error resolviendo la barra:", error);
            }
        };
        resolveBarra();

        const fetchMenu = async () => {
            try {
                const dataMenu = await getMenuCliente();
                setMenuData(dataMenu || []);
            } catch (err) {
                console.error("Error fetching menu:", err);
            } finally {
                setCargandoMenu(false);
            }
        };
        fetchMenu();
        const menuInterval = setInterval(fetchMenu, 15000);

        const fetchConfig = async () => {
            const config = await getConfiguracionLocal();
            if (config) {
                setConfigNegocio(config);
            }
        };
        fetchConfig();

        return () => clearInterval(menuInterval);
    }, []);

    // HYDRATION & POLLING FOR BARRA
    useEffect(() => {
        if (!idMesaBarra) return;

        const hydrateAndPollBarra = async () => {
            try {
                const pedido = await getPedidoActivo(idMesaBarra);
                
                // Si el pedido ha sido cerrado por el personal, marcamos los items que estaban enviados como pagados
                if (!pedido) {
                    setCarrito(prev => {
                        const hayPendientesDeCierre = prev.some(item => item.enviado && item.estadoPago !== 'pagado');
                        if (hayPendientesDeCierre) {
                            // IMPORTANTE: Solo marcamos como pagados los que ya estaban enviados
                            return prev.map(item => item.enviado ? { ...item, estadoPago: 'pagado' } : item);
                        }
                        return prev;
                    });
                    setPagoSolicitado(true);
                    setEsperandoCobro(false);
                    return;
                }

                // Si hay pedido, hidratamos
                const detalles = await getDetallesPedido(pedido.id);
                if (detalles && detalles.length > 0) {
                    const newCarrito = detalles.map(det => ({
                        producto: { id: det.id_producto, nombre: det.producto?.nombre || 'Producto', precio: det.precio_unitario },
                        nombre: det.producto?.nombre || 'Producto',
                        precioFinal: det.precio_unitario,
                        extrasAplicados: det.seleccionesOpciones?.map(sel => ({
                            opcionSeleccionada: { id: sel.id_opcion, nombre: sel.opcion?.nombre || '', suplemento: sel.precio_extra_aplicado }
                        })) || [],
                        nota: det.notas,
                        enviado: true,
                        estadoPago: det.estado === 'pagado' ? 'pagado' : null
                    }));
                    setCarrito(newCarrito);
                    if (pedido.estado === 'pendiente_cobro') setEsperandoCobro(true);
                    if (pedido.estado === 'cerrado') setPagoSolicitado(true);
                }
            } catch (err) {
                console.error("Error polling barra status:", err);
            }
        };

        hydrateAndPollBarra();
        const pollInterval = setInterval(hydrateAndPollBarra, 5000);
        return () => clearInterval(pollInterval);
    }, [idMesaBarra]);

    const categoriasTabs = ['Todo', ...menuData.map(c => c.nombre)];

    const abrirModalProducto = (prod, categoria) => {
        if (pagoSolicitado || esperandoCobro) return;
        const seleccionesIniciales = {};

        // CAMBIO: Leemos los grupos de opciones del producto
        prod.gruposOpciones?.forEach(grupo => {
            seleccionesIniciales[grupo.id] = [];
        });

        setOpcionesElegidas(seleccionesIniciales);
        setNotaOpcional("");
        setProductoModal({ prod, categoria });
    };

    const manejarSeleccionOpcion = (grupoId, opcion, max) => {
        const seleccionesActuales = opcionesElegidas[grupoId] || [];
        const yaSeleccionada = seleccionesActuales.find(o => o.id === opcion.id);

        if (max === 1) {
            setOpcionesElegidas({ ...opcionesElegidas, [grupoId]: [opcion] });
        } else {
            if (yaSeleccionada) {
                setOpcionesElegidas({
                    ...opcionesElegidas,
                    [grupoId]: seleccionesActuales.filter(o => o.id !== opcion.id)
                });
            } else {
                if (seleccionesActuales.length < max) {
                    setOpcionesElegidas({
                        ...opcionesElegidas,
                        [grupoId]: [...seleccionesActuales, opcion]
                    });
                } else {
                    alert(`Solo puedes seleccionar un máximo de ${max} opciones.`);
                }
            }
        }
    };

    const calcularPrecioFinalItem = () => {
        if (!productoModal) return 0;
        let total = productoModal.prod.precio;
        Object.values(opcionesElegidas).forEach(grupoSelecciones => {
            grupoSelecciones.forEach(opcion => total += opcion.suplemento);
        });
        return total;
    };

    const validarSelecciones = () => {
        if (!productoModal) return false;
        // VALIDANDO MIN Y MAX DE LA RELACIÓN
        return productoModal.prod.gruposOpciones?.every(grupo => {
            const numSeleccionadas = opcionesElegidas[grupo.id]?.length || 0;
            return numSeleccionadas >= (grupo.min_selecciones || 0) && numSeleccionadas <= (grupo.max_selecciones || 100);
        }) ?? true;
    };

    const confirmarAgregarAlCarrito = () => {
        if (!validarSelecciones()) {
            alert("Por favor, selecciona las opciones requeridas.");
            return;
        }
        const precioFinal = calcularPrecioFinalItem();
        const resumenOpciones = Object.values(opcionesElegidas).flat().map(opt => ({
            opcionSeleccionada: { id: opt.id, nombre: opt.nombre, suplemento: opt.suplemento }
        }));
        setCarrito([...carrito, {
            producto: { id: productoModal.prod.id, nombre: productoModal.prod.nombre, precio: productoModal.prod.precio },
            nombre: productoModal.prod.nombre,
            precioFinal,
            extrasAplicados: resumenOpciones,
            notaPersonal: notaOpcional,
            nota: notaOpcional,
            enviado: false
        }]);
        setProductoModal(null);
    };

    const eliminarDelCarrito = (indexAEliminar) => {
        setCarrito(carrito.filter((_, index) => index !== indexAEliminar));
    };

    const gestionarPago = async (metodo) => {
        if (carrito.length === 0) return;

        // Mapeo a strings específicas del Enum de la Base de Datos
        let metodoEnum = 'Efectivo';
        if (metodo === 'bizum' || metodo === 'Bizum') metodoEnum = 'Bizum';
        else if (metodo === 'gpay' || metodo === 'GooglePay') metodoEnum = 'GooglePay';
        else if (metodo === 'card' || metodo === 'Tarjeta') metodoEnum = 'Tarjeta';
        else if (metodo === 'barra') {
            metodoEnum = metodoPagoMesa === 'card' ? 'Tarjeta' : 'Efectivo';
        }

        const esDigital = metodoEnum === 'Bizum' || metodoEnum === 'GooglePay';
        const mensaje = esDigital
            ? `¿Deseas confirmar el pago con ${metodoEnum} y mandar tu pedido a barra?`
            : `¿Avisar al personal para realizar el pago en barra con ${metodoEnum}?`;

        if (window.confirm(mensaje)) {
            const itemsPorEnviar = carrito.filter(item => !item.enviado);
            if (itemsPorEnviar.length === 0) return;

            const n_pedido_barra = Math.floor(Math.random() * 999) + 1;

            try {
                if (!idMesaBarra) {
                    alert("No se ha podido identificar el ID de la barra en el sistema. Asegúrate de tener al menos una creada en el MapaEditor.");
                    return;
                }

                await submitOrder(idMesaBarra, true, n_pedido_barra, itemsPorEnviar);
                
                const pedido = await getPedidoActivo(idMesaBarra);
                if (pedido) {
                    const detalles = await getDetallesPedido(pedido.id);
                    // Marcamos los detalles recién creados (que no estaban pagados) con el método
                    for (const det of detalles) {
                        if (det.estado !== 'pagado') {
                            const nuevoEstado = esDigital ? 'pagado' : 'solicitado_mesa';
                            await actualizarEstadoDetalle(det.id, nuevoEstado, metodoEnum);
                        }
                    }

                    if (esDigital) {
                        const monto = itemsPorEnviar.reduce((acc, i) => acc + i.precioFinal, 0);
                        await registrarPago(pedido.id, monto, metodoEnum);
                    }
                }
                
                const carritoEnviado = carrito.map(item => ({ ...item, enviado: true }));
                setCarrito(carritoEnviado);
                setNumeroPedido(n_pedido_barra);

                if (esDigital) {
                    setPagoSolicitado(true);
                } else {
                    await solicitarPagoApi(idMesaBarra, metodoEnum);
                    setEsperandoCobro(true);
                }
            } catch (err) {
                console.error("Error al gestionar el pago de la barra", err);
                alert("Uy. Algo salió mal creando tú pedido.");
            }
        }
    };

    const simularConfirmacionCamarero = () => {
        // Obsoleto: El sistema sincroniza automáticamente vía polling.
    };

    const iniciarEscuchaVoz = () => {
        setEstadoVoz('escuchando');
        setMensajeVoz("Dime qué quieres pedir...");
    };

    const detenerEscuchaVoz = () => {
        setEstadoVoz('procesando');
        setMensajeVoz("Procesando tu audio...");

        setTimeout(() => {
            const exito = Math.random() > 0.3;

            if (exito) {
                setEstadoVoz('exito');
                setMensajeVoz("¡Entendido! Añadiendo Croissant al pedido...");

                const prodSimulado = menuData.length > 2 ? menuData[2].productos[0] : null;

                if (prodSimulado) {
                    setCarrito(prev => [...prev, {
                        ...prodSimulado,
                        precioFinal: prodSimulado.precio,
                        opcionesAplicadas: [],
                        nota: "Pedido rápido por voz",
                        enviado: false
                    }]);
                }

                setTimeout(() => {
                    setEstadoVoz(null);
                    setSeccionActiva('pedido');
                }, 2500);

            } else {
                setEstadoVoz('error');
                setMensajeVoz("No te he entendido bien. Había mucho ruido o el producto no está en carta.");
            }
        }, 1500);
    };

    const cancelarVoz = () => setEstadoVoz(null);

    const totalPrecioCarrito = carrito.reduce((acc, item) => acc + item.precioFinal, 0);

    if (cargandoMenu) {
        return (
            <div className="vb-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', color: '#ec9213' }}>
                    <span className="material-symbols-outlined vb-icon-spin" style={{ fontSize: '40px' }}>autorenew</span>
                    <p style={{ fontWeight: 'bold' }}>Cargando carta de barra...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="vb-container">
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;800&display=swap" rel="stylesheet" />
            <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet" />

            <div className={`vb-main-wrapper ${(productoModal || estadoVoz) ? 'no-scroll' : ''}`}>
                <header className="vb-header">
                    <div className="vb-header-icon">
                        {configNegocio.logo_url ? (
                            <img src={configNegocio.logo_url} alt="Logo" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                            <span className="material-symbols-outlined">restaurant</span>
                        )}
                    </div>
                    <h2>{configNegocio.nombre_local} (Barra)</h2>
                </header>

                <nav className="vb-nav">
                    <span
                        className={`vb-nav-link ${seccionActiva === 'menu' ? 'active' : ''} ${(pagoSolicitado || esperandoCobro) && seccionActiva !== 'menu' ? 'disabled' : ''}`}
                        onClick={() => !pagoSolicitado && !esperandoCobro && setSeccionActiva('menu')}
                    >
                        MENÚ
                    </span>
                    <span
                        className={`vb-nav-link ${seccionActiva === 'pedido' ? 'active' : ''}`}
                        onClick={() => setSeccionActiva('pedido')}
                    >
                        MI PEDIDO {carrito.length > 0 && !pagoSolicitado && <div className="vb-badge-nav">{carrito.length}</div>}
                    </span>
                </nav>

                {seccionActiva === 'menu' ? (
                    <div className="vb-page-content">
                        <section className="vb-banner">
                            <div className="vb-banner-text">
                                <h1>Pide sin colas</h1>
                                <p>Haz tu pedido desde el móvil, paga y recoge en barra cuando esté listo.</p>
                                <button className="vb-btn-voz" onClick={iniciarEscuchaVoz}>
                                    <span className="material-symbols-outlined">mic</span> Pedir por Voz
                                </button>
                            </div>
                            <div className="vb-banner-img"></div>
                        </section>

                        <div className="vb-categories no-scrollbar">
                            {categoriasTabs.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setFiltroActivo(cat)}
                                    className={`vb-cat-btn ${filtroActivo === cat ? 'active' : ''}`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        <div className="vb-product-list">
                            {menuData
                                .filter(cat => filtroActivo === 'Todo' || cat.nombre === filtroActivo)
                                .map(cat => cat.productos.map(prod => (
                                    <div key={prod.id} className="vb-card" onClick={() => abrirModalProducto(prod, cat)}>
                                        <img src={prod.img} className="vb-card-img" alt={prod.nombre} />
                                        <div className="vb-card-info">
                                            <h4>{prod.nombre}</h4>
                                            <p className="vb-card-desc">{prod.desc}</p>
                                            <div className="vb-card-footer">
                                                <span className="vb-price">{prod.precio.toFixed(2)}€</span>
                                                <div className="vb-card-actions">
                                                    <button className="vb-btn-add">
                                                        <span className="material-symbols-outlined">add</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )))}
                        </div>
                    </div>
                ) : (
                    <div className="vb-page-content">
                        <h2 className="vb-section-title">Tu Pedido</h2>
                        {carrito.length === 0 ? (
                            <div className="vb-empty-cart">
                                <p>Tu carrito está vacío.</p>
                                <button onClick={() => setSeccionActiva('menu')} className="vb-btn-text">Volver a la carta</button>
                            </div>
                        ) : (
                            <div>
                                <div className="vb-cart-list">
                                    {carrito.map((item, i) => (
                                        <div key={i} className={`vb-pedido-item ${item.enviado ? 'enviado' : ''}`}>
                                            <div className="vb-pedido-content">
                                                <div className="vb-pedido-header">
                                                    <div>
                                                        <span className="vb-pedido-name">
                                                            {item.nombre} {item.enviado && <small>✅ PAGADO</small>}
                                                        </span>
                                                        <span className="vb-pedido-price">{item.precioFinal.toFixed(2)}€</span>
                                                    </div>
                                                    {!item.enviado && !esperandoCobro && (
                                                        <button className="vb-btn-eliminar" onClick={() => eliminarDelCarrito(i)}>
                                                            <span className="material-symbols-outlined">close</span>
                                                        </button>
                                                    )}
                                                </div>

                                                {item.extrasAplicados?.length > 0 && (
                                                    <div className="vb-pedido-opciones">
                                                        {item.extrasAplicados.map((opt, idx) => (
                                                            <span key={idx} className="vb-pedido-badge-opt">
                                                                {opt.opcionSeleccionada.nombre} {opt.opcionSeleccionada.suplemento > 0 && `(+${opt.opcionSeleccionada.suplemento.toFixed(2)}€)`}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}

                                                {item.nota && (
                                                    <div className="vb-pedido-nota">
                                                        <p>📝 {item.nota}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="vb-total-card">
                                    <div className="vb-total-header">
                                        <span>Total</span>
                                        <span className="vb-total-amount">{totalPrecioCarrito.toFixed(2)}€</span>
                                    </div>
                                    {!pagoSolicitado && !esperandoCobro && (
                                        <button onClick={() => setSeccionActiva('menu')} className="vb-btn-carrito btn-orange" style={{ marginTop: '20px' }}>AÑADIR MÁS COSAS</button>
                                    )}
                                </div>

                                {esperandoCobro ? (
                                    <div className="vb-espera-card">
                                        <span className="material-symbols-outlined icon-large">hourglass_empty</span>
                                        <h3>Enseguida te cobramos</h3>
                                        <p>Por favor, acércate a la caja para abonar <strong>{totalPrecioCarrito.toFixed(2)}€</strong> en {metodoPagoMesa === 'cash' ? 'efectivo' : 'tarjeta'}.</p>
                                    </div>
                                ) : !pagoSolicitado ? (
                                    <div className="vb-pago-grid">
                                        <div className="vb-pago-card">
                                            <div className="vb-pago-header">
                                                <span className="material-symbols-outlined icon-orange">payments</span>
                                                <h3>Pagar ahora (Digital)</h3>
                                            </div>
                                            <button className="vb-btn-digital" onClick={() => gestionarPago('bizum')}>
                                                <div className="vb-digital-info">
                                                    <div className="icon-bizum">BIZUM</div>
                                                    <span>Bizum</span>
                                                </div>
                                                <span className="material-symbols-outlined text-muted">chevron_right</span>
                                            </button>
                                            <button className="vb-btn-digital" onClick={() => gestionarPago('gpay')}>
                                                <div className="vb-digital-info">
                                                    <span className="material-symbols-outlined icon-gpay">google</span>
                                                    <span>Google Pay</span>
                                                </div>
                                                <span className="material-symbols-outlined text-muted">chevron_right</span>
                                            </button>
                                        </div>

                                        <div className="vb-pago-card">
                                            <div className="vb-pago-header">
                                                <span className="material-symbols-outlined icon-orange">storefront</span>
                                                <h3>Pagar en barra</h3>
                                            </div>
                                            <div className="vb-radio-group">
                                                <div className={`vb-radio-box ${metodoPagoMesa === 'cash' ? 'active' : ''}`} onClick={() => setMetodoPagoMesa('cash')}>
                                                    <span className="material-symbols-outlined">payments</span>
                                                    <span>Efectivo</span>
                                                </div>
                                                <div className={`vb-radio-box ${metodoPagoMesa === 'card' ? 'active' : ''}`} onClick={() => setMetodoPagoMesa('card')}>
                                                    <span className="material-symbols-outlined">credit_card</span>
                                                    <span>Tarjeta</span>
                                                </div>
                                            </div>
                                            <button className="vb-btn-carrito btn-dark" onClick={() => gestionarPago('barra')}>
                                                <span className="material-symbols-outlined">notifications_active</span>
                                                AVISAR PARA PAGAR
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="vb-pago-card vb-success-card">
                                        <span className="material-symbols-outlined icon-success">check_circle</span>
                                        <h3>¡Pago confirmado!</h3>
                                        <p>Tu pedido ya se está preparando en cocina.</p>

                                        <div className="vb-ticket-box">
                                            <p>Tu número de recogida</p>
                                            <h2>#{numeroPedido}</h2>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {seccionActiva === 'menu' && carrito.length > 0 && (
                    <div className="vb-footer-actions">
                        <button className="vb-btn-carrito" onClick={() => setSeccionActiva('pedido')}>
                            <span className="material-symbols-outlined">shopping_basket</span>
                            VER MI PEDIDO ({totalPrecioCarrito.toFixed(2)}€)
                        </button>
                    </div>
                )}
            </div>

            {/* MODAL DE PRODUCTO */}
            {productoModal && (
                <>
                    <div className="vb-modal-backdrop" onClick={() => setProductoModal(null)}></div>
                    <div className="vb-product-sheet">
                        <button className="vb-sheet-close" onClick={() => setProductoModal(null)}>
                            <span className="material-symbols-outlined">close</span>
                        </button>

                        <div className="vb-sheet-header">
                            <img src={productoModal.prod.img} alt="" />
                            <div className="vb-sheet-title">
                                <h3>{productoModal.prod.nombre}</h3>
                                <p>{productoModal.prod.desc}</p>
                                <span className="vb-sheet-price">{productoModal.prod.precio.toFixed(2)}€ base</span>
                            </div>
                        </div>

                        <div className="vb-sheet-content">
                            {productoModal.prod.gruposOpciones?.map(grupo => {
                                const numSeleccionadas = opcionesElegidas[grupo.id]?.length || 0;
                                const esValido = numSeleccionadas >= (grupo.min_selecciones || 0) && numSeleccionadas <= (grupo.max_selecciones || 100);

                                return (
                                    <div key={grupo.id} className="vb-option-group">
                                        <h4 className="vb-group-title">
                                            {grupo.nombre}
                                            {grupo.min_selecciones > 0 ? (
                                                <span className={`vb-req-badge ${esValido ? 'valido' : 'pendiente'}`}>
                                                    {numSeleccionadas < grupo.min_selecciones
                                                        ? `Selecciona al menos ${grupo.min_selecciones}`
                                                        : `Mínimo cumplido (${numSeleccionadas})`}
                                                </span>
                                            ) : (
                                                <span className="vb-opt-badge">Opcional (máx {grupo.max_selecciones})</span>
                                            )}
                                        </h4>
                                        <div className="vb-options-list">
                                            {grupo.opciones.map(opcion => {
                                                const isSelected = opcionesElegidas[grupo.id]?.some(o => o.id === opcion.id);
                                                return (
                                                    <div
                                                        key={opcion.id}
                                                        className={`vb-option-row ${isSelected ? 'selected' : ''}`}
                                                        onClick={() => manejarSeleccionOpcion(grupo.id, opcion, grupo.max_selecciones)}
                                                    >
                                                        <div className={grupo.max_selecciones === 1 ? "vb-radio-custom" : "vb-checkbox-custom"}>
                                                            {isSelected && (
                                                                grupo.max_selecciones === 1
                                                                    ? <div className="vb-radio-dot"></div>
                                                                    : <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check</span>
                                                            )}
                                                        </div>
                                                        <span className="vb-option-name">{opcion.nombre}</span>
                                                        {opcion.suplemento > 0 && (
                                                            <span className="vb-option-sup">+{opcion.suplemento.toFixed(2)}€</span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}

                            <div className="vb-option-group">
                                <h4 className="vb-group-title">Notas adicionales</h4>
                                <textarea
                                    className="vb-textarea-notes"
                                    placeholder="Ej: Muy caliente, sin azúcar..."
                                    value={notaOpcional}
                                    onChange={(e) => setNotaOpcional(e.target.value)}
                                ></textarea>
                            </div>
                        </div>

                        <div className="vb-sheet-footer">
                            <button
                                className={`vb-btn-carrito ${!validarSelecciones() ? 'disabled' : ''}`}
                                onClick={confirmarAgregarAlCarrito}
                                disabled={!validarSelecciones()}
                            >
                                {validarSelecciones()
                                    ? `Añadir al carrito • ${calcularPrecioFinalItem().toFixed(2)}€`
                                    : 'Completa las opciones requeridas'}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {estadoVoz && (
                <div className="vb-voz-overlay">
                    <div className="vb-voz-content">
                        {estadoVoz === 'escuchando' && (
                            <>
                                <h2>{mensajeVoz}</h2>
                                <div className="vb-mic-pulse-container" onClick={detenerEscuchaVoz}>
                                    <div className="pulse-ring"></div>
                                    <div className="pulse-ring delay"></div>
                                    <span className="material-symbols-outlined mic-icon">mic</span>
                                </div>
                                <p className="vb-voz-hint">Toca el micrófono cuando termines de hablar</p>
                                <button className="vb-btn-voz-close" onClick={cancelarVoz}>Cancelar</button>
                            </>
                        )}
                        {estadoVoz === 'procesando' && (
                            <>
                                <span className="material-symbols-outlined vb-icon-spin">autorenew</span>
                                <h2>{mensajeVoz}</h2>
                                <p className="vb-voz-hint">Analizando pedido con IA...</p>
                            </>
                        )}
                        {estadoVoz === 'exito' && (
                            <>
                                <span className="material-symbols-outlined vb-icon-success">check_circle</span>
                                <h2>Pedido realizado</h2>
                                <p className="vb-voz-hint">{mensajeVoz}</p>
                            </>
                        )}
                        {estadoVoz === 'error' && (
                            <>
                                <span className="material-symbols-outlined vb-icon-error">error</span>
                                <h2>Mmm... no lo tengo claro</h2>
                                <p className="vb-voz-hint">{mensajeVoz}</p>
                                <div className="vb-voz-error-actions">
                                    <button className="vb-btn-carrito" onClick={iniciarEscuchaVoz}>
                                        <span className="material-symbols-outlined">replay</span> Volver a intentar
                                    </button>
                                    <button className="vb-btn-text" onClick={cancelarVoz} style={{ marginTop: '15px' }}>
                                        Hacer pedido manual
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default VistaBarra;