import React, { useState, useEffect } from 'react';
import './VistaBarra.css';
import { getMenuCliente } from '../services/apiMenuManager';
import {
    submitOrder,
    getMesaByUuid,
    getPedidoActivo,
    getDetallesPedido,
    registrarPago,
    actualizarEstadoDetalle,
    solicitarPago as solicitarPagoApi
} from '../services/apiCliente';
import { fetchApi } from '../services/apiClient';
import { getConfiguracionLocal } from '../services/apiAuth';
import { useParams } from 'react-router-dom';
import { useCustomModal } from '../components/useCustomModal';
import { useTranslation, Trans } from 'react-i18next';
import LanguageSelector from '../components/LanguageSelector';

const VistaBarra = () => {
    const { t } = useTranslation();
    const { showAlert, showConfirm, ModalComponent } = useCustomModal();
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

                // Si el pedido no existe, verificamos si tenemos cosas enviadas pendientes
                if (!pedido) {
                    setCarrito(prev => {
                        const hayEnviados = prev.some(item => item.enviado);
                        if (hayEnviados) {
                            setPagoSolicitado(true);
                        } else {
                            setPagoSolicitado(false);
                        }
                        setEsperandoCobro(false);

                        const hayPendientesDeCierre = prev.some(item => item.enviado && item.estadoPago !== 'pagado');
                        if (hayPendientesDeCierre) {
                            return prev.map(item => item.enviado ? { ...item, estadoPago: 'pagado' } : item);
                        }
                        return prev;
                    });
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
                    showAlert(t('max_opciones_alert', {max}), "warning");
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
            showAlert(t('Modal_opciones_req'), "warning");
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
        const metodoTranslated = metodoEnum === 'Efectivo' ? String(t('efectivo')).toLowerCase() : 
                                 metodoEnum === 'Tarjeta' ? String(t('tarjeta')).toLowerCase() : metodoEnum;
        
        const mensaje = esDigital
            ? t('Confirm_pago_digital_barra', {metodo: metodoEnum})
            : t('Confirm_pago_fisico_barra', {metodo: metodoTranslated});

        if (await showConfirm(mensaje)) {
            const itemsPorEnviar = carrito.filter(item => !item.enviado);
            if (itemsPorEnviar.length === 0) return;

            const n_pedido_barra = Math.floor(Math.random() * 999) + 1;

            try {
                if (!idMesaBarra) {
                    showAlert(t('Error_id_barra'), "error");
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
                    if (configNegocio.link_resenas_google) {
                        setTimeout(async () => {
                            if (await showConfirm(t("Review_google_title"), t("Review_google_desc_barra"), t("Review_google_yes"), t("Review_google_no"))) {
                                window.open(configNegocio.link_resenas_google, '_blank');
                            }
                        }, 500);
                    }
                } else {
                    await solicitarPagoApi(idMesaBarra, metodoEnum);
                    setEsperandoCobro(true);
                }
            } catch (err) {
                console.error("Error al gestionar el pago de la barra", err);
                showAlert(t('Algo_salio_mal'), "error");
            }
        }
    };

    const simularConfirmacionCamarero = () => {
        // Obsoleto: El sistema sincroniza automáticamente vía polling.
    };

    const iniciarEscuchaVoz = () => {
        setEstadoVoz('escuchando');
        setMensajeVoz(t('Escuchando_voz'));
    };

    const detenerEscuchaVoz = () => {
        setEstadoVoz('procesando');
        setMensajeVoz(t('Procesando_voz'));

        setTimeout(() => {
            const exito = Math.random() > 0.3;

            if (exito) {
                setEstadoVoz('exito');
                setMensajeVoz(t('Exito_voz'));

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
                setMensajeVoz(t('Error_voz'));
            }
        }, 1500);
    };

    const cancelarVoz = () => setEstadoVoz(null);

    const totalPrecioCarrito = carrito.reduce((acc, item) => acc + item.precioFinal, 0);

    if (cargandoMenu) {
        return (
            <div className="vb-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', color: 'var(--primary)' }}>
                    <span className="material-symbols-outlined vb-icon-spin" style={{ fontSize: '40px' }}>autorenew</span>
                    <p style={{ fontWeight: 'bold' }}>{t('Cargando_carta_barra')}</p>
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
                    <LanguageSelector />
                </header>

                <nav className="vb-nav">
                    <span
                        className={`vb-nav-link ${seccionActiva === 'menu' ? 'active' : ''} ${(pagoSolicitado || esperandoCobro) && seccionActiva !== 'menu' ? 'disabled' : ''}`}
                        onClick={() => !pagoSolicitado && !esperandoCobro && setSeccionActiva('menu')}
                    > {t('MENU')} </span>
                    <span
                        className={`vb-nav-link ${seccionActiva === 'pedido' ? 'active' : ''}`}
                        onClick={() => setSeccionActiva('pedido')}
                    >
                        {t('MI PEDIDO')} {carrito.length > 0 && !pagoSolicitado && <div className="vb-badge-nav">{carrito.length}</div>}
                    </span>
                </nav>

                {seccionActiva === 'menu' ? (
                    <div className="vb-page-content">
                        <section className="vb-banner">
                            <div className="vb-banner-text">
                                <h1>{t('Pide_sin_colas')}</h1>
                                <p>{t('Pide_sin_colas_desc')}</p>
                                <button className="vb-btn-voz" onClick={iniciarEscuchaVoz}>
                                    <span className="material-symbols-outlined">mic</span> {t('Pedir_voz')}
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
                                    {t(cat)}
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
                                            <h4>{t(prod.nombre)}</h4>
                                            <p className="vb-card-desc">{t(prod.desc)}</p>
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
                        <h2 className="vb-section-title">{t('Tu_Pedido')}</h2>
                        {carrito.length === 0 ? (
                            <div className="vb-empty-cart">
                                <p>{t('Tu_carrito_vacio')}</p>
                                <button onClick={() => setSeccionActiva('menu')} className="vb-btn-text">{t('Volver_a_carta')}</button>
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
                                                            {t(item.nombre)} {item.enviado && <small>{t('PAGADO_badge')}</small>}
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
                                                                {t(opt.opcionSeleccionada.nombre)} {opt.opcionSeleccionada.suplemento > 0 && `(+${opt.opcionSeleccionada.suplemento.toFixed(2)}€)`}
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
                                        <span>{t('Total')}</span>
                                        <span className="vb-total-amount">{totalPrecioCarrito.toFixed(2)}€</span>
                                    </div>
                                    {!pagoSolicitado && !esperandoCobro && (
                                        <button onClick={() => setSeccionActiva('menu')} className="vb-btn-carrito btn-orange" style={{ marginTop: '20px' }}>{t("Anadir_mas_cosas")}</button>
                                    )}
                                </div>

                                {esperandoCobro ? (
                                    <div className="vb-espera-card">
                                        <span className="material-symbols-outlined icon-large">hourglass_empty</span>
                                        <h3>{t('Enseguida_te_cobramos')}</h3>
                                        <p><Trans i18nKey="Enseguida_te_cobramos_desc" values={{ total: totalPrecioCarrito.toFixed(2), metodo: metodoPagoMesa === 'cash' ? t('efectivo') : t('tarjeta') }}>Por favor, acércate a la caja para abonar <strong>{totalPrecioCarrito.toFixed(2)}€</strong> en {metodoPagoMesa === 'cash' ? t('efectivo') : t('tarjeta')}.</Trans></p>
                                    </div>
                                ) : !pagoSolicitado ? (
                                    <div className="vb-pago-grid">
                                        <div className="vb-pago-card">
                                            <div className="vb-pago-header">
                                                <span className="material-symbols-outlined icon-orange">payments</span>
                                                <h3>{t('Pagar_ahora_digital')}</h3>
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
                                                <h3>{t('Pagar_en_barra')}</h3>
                                            </div>
                                            <div className="vb-radio-group">
                                                <div className={`vb-radio-box ${metodoPagoMesa === 'cash' ? 'active' : ''}`} onClick={() => setMetodoPagoMesa('cash')}>
                                                    <span className="material-symbols-outlined">payments</span>
                                                    <span>{t('Efectivo_titulo')}</span>
                                                </div>
                                                <div className={`vb-radio-box ${metodoPagoMesa === 'card' ? 'active' : ''}`} onClick={() => setMetodoPagoMesa('card')}>
                                                    <span className="material-symbols-outlined">credit_card</span>
                                                    <span>{t('Tarjeta_titulo')}</span>
                                                </div>
                                            </div>
                                            <button className="vb-btn-carrito btn-dark" onClick={() => gestionarPago('barra')}>
                                                <span className="material-symbols-outlined">notifications_active</span>
                                                {t('avisar_para_pagar')}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="vb-pago-card vb-success-card">
                                        <span className="material-symbols-outlined icon-success">check_circle</span>
                                        <h3>{t('Pago_confirmado')}</h3>
                                        <p>{t('Pago_confirmado_desc')}</p>

                                        <div className="vb-ticket-box">
                                            <p>{t('Tu_numero_recogida')}</p>
                                            <h2>#{numeroPedido}</h2>
                                        </div>
                                        <button className="vb-btn-carrito btn-dark" onClick={() => {
                                            setCarrito([]);
                                            setPagoSolicitado(false);
                                            setNumeroPedido(null);
                                            setSeccionActiva('menu');
                                        }} style={{ marginTop: '20px', width: '100%', maxWidth: '300px' }}>
                                            {t('Nuevo_pedido')}
                                        </button>
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
                            {t('VER_MI_PEDIDO', {total: totalPrecioCarrito.toFixed(2)})}
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
                                <h3>{t(productoModal.prod.nombre)}</h3>
                                <p>{t(productoModal.prod.desc)}</p>
                                <span className="vb-sheet-price">{productoModal.prod.precio.toFixed(2)}€ {t('base')}</span>
                            </div>
                        </div>

                        <div className="vb-sheet-content">
                            {productoModal.prod.gruposOpciones?.map(grupo => {
                                const numSeleccionadas = opcionesElegidas[grupo.id]?.length || 0;
                                const esValido = numSeleccionadas >= (grupo.min_selecciones || 0) && numSeleccionadas <= (grupo.max_selecciones || 100);

                                return (
                                    <div key={grupo.id} className="vb-option-group">
                                        <h4 className="vb-group-title">
                                            {t(grupo.nombre)}
                                            {grupo.min_selecciones > 0 ? (
                                                <span className={`vb-req-badge ${esValido ? 'valido' : 'pendiente'}`}>
                                                    {numSeleccionadas < grupo.min_selecciones
                                                        ? t('Selecciona_al_menos', {min: grupo.min_selecciones})
                                                        : t('Minimo_cumplido', {count: numSeleccionadas})}
                                                </span>
                                            ) : (
                                                <span className="vb-opt-badge">{t('Opcional_max', {max: grupo.max_selecciones})}</span>
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
                                                        <span className="vb-option-name">{t(opcion.nombre)}</span>
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
                                <h4 className="vb-group-title">{t('Notas_adicionales')}</h4>
                                <textarea
                                    className="vb-textarea-notes"
                                    placeholder={t('Ejemplo_notas')}
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
                                    ? t('Anadir_carrito_btn', {precio: calcularPrecioFinalItem().toFixed(2)})
                                    : t('Completa_opciones')}
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
                                <p className="vb-voz-hint">{t('Hint_voz')}</p>
                                <button className="vb-btn-voz-close" onClick={cancelarVoz}>{t('Cancelar')}</button>
                            </>
                        )}
                        {estadoVoz === 'procesando' && (
                            <>
                                <span className="material-symbols-outlined vb-icon-spin">autorenew</span>
                                <h2>{mensajeVoz}</h2>
                                <p className="vb-voz-hint">{t('Hint_procesando')}</p>
                            </>
                        )}
                        {estadoVoz === 'exito' && (
                            <>
                                <span className="material-symbols-outlined vb-icon-success">check_circle</span>
                                <h2>{t('Pedido_realizado', 'Pedido realizado')}</h2>
                                <p className="vb-voz-hint">{mensajeVoz}</p>
                            </>
                        )}
                        {estadoVoz === 'error' && (
                            <>
                                <span className="material-symbols-outlined vb-icon-error">error</span>
                                <h2>{t('Mmm_no_lo_tengo_claro', 'Mmm... no lo tengo claro')}</h2>
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
            <ModalComponent />
        </div>
    );
};

export default VistaBarra;