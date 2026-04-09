import React, { useState, useEffect, useRef } from 'react';
import './VistaBarra.css';
import { getMenuCliente } from '../services/apiMenuManager';
import {
    submitOrder,
    getMesaByUuid,
    getPedidoActivo,
    getDetallesPedido,
    registrarPago,
    actualizarEstadoDetalle,
    solicitarPago as solicitarPagoApi,
    finalizarPedido
} from '../services/apiCliente';
import { fetchApi } from '../services/apiClient';
import { getConfiguracionLocal } from '../services/apiAuth';
import { useParams } from 'react-router-dom';
import { useCustomModal } from '../components/useCustomModal';
import { useTranslation, Trans } from 'react-i18next';
import LanguageSelector from '../components/LanguageSelector';
import { voiceService } from '../services/voiceService';

const VistaBarra = () => {
    const { t } = useTranslation();

    const formatUrl = (url) => {
        if (!url) return '';
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        return `https://${url}`;
    };
    const { showAlert, showConfirm, ModalComponent } = useCustomModal();
    const [seccionActiva, setSeccionActiva] = useState('menu');
    const [filtroActivo, setFiltroActivo] = useState('Todo');
    const [carrito, setCarrito] = useState(() => {
        try {
            const saved = sessionStorage.getItem('traeme_carrito_barra');
            if (saved) return JSON.parse(saved);
        } catch (e) {}
        return [];
    });
    const [metodoPagoMesa, setMetodoPagoMesa] = useState('cash');
    const [pagoSolicitado, setPagoSolicitado] = useState(false);
    const [esperandoCobro, setEsperandoCobro] = useState(false);
    const [numeroPedido, setNumeroPedido] = useState(null);

    const { uuid } = useParams();
    const [idMesaBarra, setIdMesaBarra] = useState(null);

    const [productoModal, setProductoModal] = useState(null);
    const [opcionesElegidas, setOpcionesElegidas] = useState({});
    const [notaOpcional, setNotaOpcional] = useState("");

    const [busqueda, setBusqueda] = useState('');
    const [estadoVoz, setEstadoVoz] = useState(null);
    const [mensajeVoz, setMensajeVoz] = useState("");

    const [menuData, setMenuData] = useState([]);
    const [cargandoMenu, setCargandoMenu] = useState(true);

    const [configNegocio, setConfigNegocio] = useState({ nombre_local: 'Cargando...', logo_url: null });

    const carritoRef = useRef(carrito);
    useEffect(() => {
        carritoRef.current = carrito;
        try {
            const localItems = carrito.filter(c => !c.enviado);
            if (localItems.length > 0) {
                sessionStorage.setItem('traeme_carrito_barra', JSON.stringify(localItems));
            } else {
                sessionStorage.removeItem('traeme_carrito_barra');
            }
        } catch(e) {}
    }, [carrito]);

    useEffect(() => {
        let resolveInterval;
        const resolveBarra = async () => {
            try {
                if (uuid) {
                    const data = await getMesaByUuid(uuid);
                    const mesaValida = Array.isArray(data) ? data[0] : (data.data || data);
                    if (mesaValida && mesaValida.id) {
                        setIdMesaBarra(mesaValida.id);
                        if (resolveInterval) clearInterval(resolveInterval);
                    }
                } else {
                    const mesas = await fetchApi('/mesa') || [];
                    const primerBarra = mesas.find(m => m.tipo === 'barra');
                    if (primerBarra) {
                        setIdMesaBarra(primerBarra.id);
                        if (resolveInterval) clearInterval(resolveInterval);
                    }
                    else if (mesas.length > 0) {
                        setIdMesaBarra(mesas[0].id);
                        if (resolveInterval) clearInterval(resolveInterval);
                    }
                }
            } catch (error) {
                console.error("Error resolviendo la barra (reintentando en 3s):", error);
            }
        };
        resolveBarra();
        resolveInterval = setInterval(() => {
            if (!idMesaBarra) resolveBarra();
        }, 3000);

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

        return () => {
            clearInterval(menuInterval);
            if (resolveInterval) clearInterval(resolveInterval);
        };
    }, []);

    // HYDRATION & POLLING FOR BARRA
    useEffect(() => {
        if (!idMesaBarra) return;

        const hydrateAndPollBarra = async () => {
            try {
                const pedido = await getPedidoActivo(idMesaBarra, true);

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
                    const newCarrito = detalles
                        .filter(det => det.estado !== 'servido') // HIDE SERVED ITEMS
                        .map(det => ({
                            producto: { id: det.id_producto, nombre: det.producto?.nombre || 'Producto', precio: det.precio_unitario },
                            nombre: det.producto?.nombre || 'Producto',
                            precioFinal: det.precio_unitario,
                            extrasAplicados: det.seleccionesOpciones?.map(sel => ({
                                opcionSeleccionada: { id: sel.id_opcion, nombre: sel.opcion?.nombre || '', suplemento: sel.precio_extra_aplicado }
                            })) || [],
                            nota: det.notas,
                            enviado: true,
                            estadoPago: (det.estado === 'pagado' || det.estado === 'listo' || det.estado === 'preparando' || det.estado === 'servido') ? 'pagado' : (det.estado === 'solicitado_mesa' ? 'solicitado_mesa' : null),
                            estado: det.estado
                        }));
                    // Recover ticket number from the active order (notes)
                    const ticketMatch = detalles.find(d => d.notas?.includes('[Ticket #'))?.notas.match(/\[Ticket #(\d+)\]/);
                    if (ticketMatch) {
                        setNumeroPedido(parseInt(ticketMatch[1]));
                    }

                    const localItems = carritoRef.current.filter(item => !item.enviado);
                    const merged = [...localItems, ...newCarrito];

                    // AUTO-CLOSE & RESET: Si ya no quedan items por servir, y todo lo enviado está pagado
                    const hasUnpaid = detalles.some(det => det.estado !== 'pagado' && det.estado !== 'listo' && det.estado !== 'preparando' && det.estado !== 'servido');
                    const allServed = detalles.every(det => det.estado === 'servido');

                    if (detalles.length > 0 && allServed && !hasUnpaid && localItems.length === 0) {
                         // Cerramos el pedido automáticamente para limpiar la mesa para el siguiente cliente
                         finalizarPedido(pedido.id, null).catch(console.error);
                         setPagoSolicitado(false);
                         setEsperandoCobro(false);
                         // NO quitamos el número de pedido aquí, dejamos que el usuario lo vea hasta que lo borre él
                         setCarrito([]);
                         return;
                    }

                    // Si el pedido se cerró externamente, limpiamos
                    if (pedido.estado === 'cerrado' && merged.length === 0) {
                        setPagoSolicitado(false);
                        setEsperandoCobro(false);
                        setNumeroPedido(null);
                        setCarrito([]);
                        return;
                    }

                    setCarrito(merged);

                    // Reconstruir los banners de pago/espera si se recarga la página
                    const sentItems = merged.filter(i => i.enviado);
                    const sentUnpaidCount = sentItems.filter(i => i.estadoPago !== 'pagado').length;

                    if (sentItems.length > 0 && sentUnpaidCount === 0 && localItems.length === 0) {
                        setPagoSolicitado(true);
                        setEsperandoCobro(false);
                    } else if (pedido.estado === 'pendiente_cobro') {
                        setEsperandoCobro(true);
                        setPagoSolicitado(false);
                    }
                }
            } catch (err) {
                console.error("Error polling barra status:", err);
            }
        };

        hydrateAndPollBarra();
        const pollInterval = setInterval(hydrateAndPollBarra, 5000);
        return () => clearInterval(pollInterval);
    }, [idMesaBarra]);

    const normalizarTexto = (texto) => {
        if (!texto) return "";
        return texto
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
            .replace(/\s+/g, ""); // Eliminar espacios
    };

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
        const itemsToPay = carrito.filter(item => item.estadoPago !== 'pagado');
        if (itemsToPay.length === 0) return;

        const itemsPorEnviar = itemsToPay.filter(item => !item.enviado);
        if (itemsPorEnviar.length === 0) return;

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
        
            const totalItems = itemsToPay.reduce((acc, i) => acc + i.precioFinal, 0).toFixed(2);
            const mensaje = esDigital
                ? t('Confirm_pago_digital_barra', {metodo: metodoEnum, total: totalItems})
                : t('Confirm_pago_fisico_barra', {metodo: metodoTranslated, total: totalItems});

        if (await showConfirm(mensaje)) {
            if (itemsPorEnviar.length === 0) return;

            // Cálculo del número de pedido: Secuencial por día
            let n_pedido_barra = 1;
            try {
                const todosPedidos = await fetchApi('/pedido') || [];
                const hoy = new Date().toISOString().split('T')[0];
                const pedidosHoy = todosPedidos.filter(p => 
                    p.id_mesa === idMesaBarra && 
                    p.creado_at?.startsWith(hoy)
                );
                // El nuevo número es el total de registrados hoy + 1
                n_pedido_barra = pedidosHoy.length + 1;
            } catch (err) {
                console.error("Error calculando número secuencial, usando fallback random:", err);
                n_pedido_barra = Math.floor(Math.random() * 999) + 1;
            }

            try {
                if (!idMesaBarra) {
                    showAlert(t('Error_id_barra'), "error");
                    return;
                }

                await submitOrder(idMesaBarra, true, n_pedido_barra, itemsPorEnviar);

                const pedido = await getPedidoActivo(idMesaBarra, true);
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
                                window.open(formatUrl(configNegocio.link_resenas_google), '_blank');
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

    const iniciarEscuchaVoz = async () => {
        console.log("User (Barra): Pulsó botón de voz (Modo Universal)");
        try {
            setEstadoVoz('escuchando');
            setMensajeVoz(t('Escuchando_voz'));
            await voiceService.startRecording(() => detenerEscuchaVoz());
        } catch (err) {
            console.error("Error al iniciar grabación universal en barra:", err);
            setEstadoVoz(null);
            showAlert(t('Algo_salio_mal'), 'error');
        }
    };

    const detenerEscuchaVoz = async () => {
        if (voiceService.isRecording) {
            setEstadoVoz('procesando');
            setMensajeVoz(t('Procesando_voz'));
            try {
                const audioBlob = await voiceService.stopRecording();
                const transcript = await voiceService.transcribe(audioBlob);
                console.log("Universal Speech (Barra): Transcripción:", transcript);
                
                if (transcript && transcript.trim().length > 0) {
                    analizarPedidoVoz(transcript);
                } else {
                    throw new Error("Transcripción vacía");
                }
            } catch (err) {
                console.error("Error en flujo de voz universal en barra:", err);
                setEstadoVoz('error');
                setMensajeVoz(t('Error_voz'));
                setTimeout(() => setEstadoVoz(null), 3000);
            }
        }
    };

    const cancelarVoz = () => {
        if (voiceService.isRecording) {
            voiceService.stopRecording().catch(() => {});
        }
        setEstadoVoz(null);
    };

    const analizarPedidoVoz = async (transcript) => {
        try {
            setEstadoVoz('procesando');
            setMensajeVoz(t('Procesando_pedido'));
            
            // Usamos el nuevo servicio con IA para parsear el pedido estructurado
            const itemsExtraidos = await voiceService.parseOrder(transcript, menuData);
            
            if (!itemsExtraidos || itemsExtraidos.length === 0) {
                setEstadoVoz('error');
                setMensajeVoz(t('Error_voz_no_entiendo'));
                setTimeout(() => setEstadoVoz(null), 3000);
                return;
            }

            const todosProductos = [];
            menuData.forEach(cat => {
                cat.productos?.forEach(p => todosProductos.push(p));
            });

            const itemsParaAgregar = [];
            const labelsConfirmacion = [];

            for (const item of itemsExtraidos) {
                const prod = todosProductos.find(p => p.id === item.productId);
                if (!prod) continue;

                let precioExtra = 0;
                const opcionesAplicadas = [];
                const nombresOpciones = [];

                if (item.optionIds && item.optionIds.length > 0) {
                    prod.gruposOpciones?.forEach(grupo => {
                        grupo.opciones?.forEach(opt => {
                            if (item.optionIds.includes(opt.id)) {
                                opcionesAplicadas.push({
                                    opcionSeleccionada: { id: opt.id, nombre: opt.nombre, suplemento: opt.suplemento }
                                });
                                precioExtra += opt.suplemento;
                                nombresOpciones.push(t(opt.nombre));
                            }
                        });
                    });
                }

                itemsParaAgregar.push({
                    producto: { id: prod.id, nombre: prod.nombre, precio: prod.precio },
                    nombre: prod.nombre,
                    precioFinal: prod.precio + precioExtra,
                    extrasAplicados: opcionesAplicadas,
                    nota: item.notes || "",
                    enviado: false
                });

                let label = t(prod.nombre);
                if (nombresOpciones.length > 0) label += ` (${nombresOpciones.join(", ")})`;
                if (item.notes) label += ` [${item.notes}]`;
                labelsConfirmacion.push(label);
            }

            setEstadoVoz(null);

            if (itemsParaAgregar.length > 0) {
                const itemsListStr = labelsConfirmacion.map(l => `• ${l}`).join("\n");
                const mensajeConfirm = t('Confirm_voz_pedido_multiple', { items: itemsListStr });

                if (await showConfirm(mensajeConfirm, t('Pedido_por_voz'))) {
                    setCarrito(prev => [...prev, ...itemsParaAgregar]);
                    showAlert(t('Exito_voz'), 'success');
                    setSeccionActiva('pedido');
                }
            } else {
                setEstadoVoz('error');
                setMensajeVoz(t('Error_voz_no_entiendo'));
                setTimeout(() => setEstadoVoz(null), 3000);
            }
        } catch (err) {
            console.error("Error en analizarPedidoVoz en barra:", err);
            setEstadoVoz('error');
            setMensajeVoz(t('Algo_salio_mal'));
            setTimeout(() => setEstadoVoz(null), 3000);
        }
    };


    const totalPrecioCarrito = carrito.reduce((acc, item) => acc + item.precioFinal, 0);
    const totalPendientePago = carrito.filter(item => item.estadoPago !== 'pagado').reduce((acc, i) => acc + i.precioFinal, 0);

    if (!idMesaBarra) {
        return (
            <div className="vb-container" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', gap: '20px' }}>
                <span className="material-symbols-outlined vb-icon-spin" style={{ fontSize: '48px', color: '#f39c12' }}>autorenew</span>
                <h2>Conectando con la Barra...</h2>
                <p>Esperando conexión con el servidor principal.</p>
            </div>
        );
    }

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
                        {configNegocio.logo_url && configNegocio.logo_url !== "" ? (
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
                        className={`vb-nav-link ${seccionActiva === 'menu' ? 'active' : ''} ${((pagoSolicitado || esperandoCobro) && totalPendientePago > 0) && seccionActiva !== 'menu' ? 'disabled' : ''}`}
                        onClick={() => (!(pagoSolicitado || esperandoCobro) || totalPendientePago === 0) && setSeccionActiva('menu')}
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
                            <div className="vb-banner-text" style={{ flex: 1 }}>
                                <h1>{t('Pide_sin_colas')}</h1>
                                <p>{t('Pide_sin_colas_desc')}</p>
                                <div className="vb-search-container">
                                    <span className="material-symbols-outlined vb-search-icon">search</span>
                                    <input
                                        type="text"
                                        placeholder={t('Buscar_platos', 'Buscar platos...')}
                                        className="vb-search-input"
                                        value={busqueda}
                                        onChange={(e) => setBusqueda(e.target.value)}
                                    />
                                </div>
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
                                .map(cat => cat.productos
                                    .filter(prod => {
                                        const nombreMatch = normalizarTexto(t(prod.nombre)).includes(normalizarTexto(busqueda));
                                        const descMatch = normalizarTexto(t(prod.desc)).includes(normalizarTexto(busqueda));
                                        return nombreMatch || descMatch;
                                    })
                                    .map(prod => (
                                        <div key={prod.id} className="vb-card" onClick={() => abrirModalProducto(prod, cat)}>
                                            {prod.img && prod.img !== "" && <img src={prod.img} className="vb-card-img" alt={prod.nombre} />}
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
                                                         <div style={{ flex: 1 }}>
                                                            <span className="vb-pedido-name">
                                                                {t(item.nombre)}
                                                                {item.estadoPago === 'pagado' ? (
                                                                    <small style={{ color: '#34a853', marginLeft: '5px' }}>{t('PAGADO_badge')}</small>
                                                                ) : item.estado === 'servido' ? (
                                                                    <small style={{ color: '#0ea5e9', marginLeft: '5px' }}>{t('SERVIDO_badge')}</small>
                                                                ) : (
                                                                    item.enviado && <small style={{ color: 'var(--primary)', marginLeft: '5px' }}>{t('EN_COCINA_badge')}</small>
                                                                )}
                                                            </span>
                                                        </div>
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
                                        <p><Trans i18nKey="Enseguida_te_cobramos_desc" values={{ total: totalPendientePago.toFixed(2), metodo: metodoPagoMesa === 'cash' ? t('efectivo') : t('tarjeta') }}>Por favor, acércate a la caja para abonar <strong>{totalPendientePago.toFixed(2)}€</strong> en {metodoPagoMesa === 'cash' ? t('efectivo') : t('tarjeta')}.</Trans></p>
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
                                        <button className="vb-btn-carrito btn-dark" onClick={async () => {
                                            try {
                                                // Close the current order for this bar table so the next order gets a fresh ID
                                                const pedido = await getPedidoActivo(idMesaBarra, true);
                                                if (pedido) {
                                                    const { finalizarPedido } = await import('../services/apiCliente');
                                                    await finalizarPedido(pedido.id, null); // don't invalidate mesa UUID for bar
                                                }
                                                // Sólo limpiamos la interfaz si la petición no falló.
                                                setCarrito([]);
                                                setPagoSolicitado(false);
                                                setNumeroPedido(null);
                                                setSeccionActiva('menu');
                                            } catch (err) {
                                                console.error("Error cerrando pedido al hacer nuevo pedido", err);
                                                showAlert("Error de conexión con la base de datos al cerrar el ticket anterior. Inténtalo de nuevo.", "error");
                                            }
                                        }} style={{ marginTop: '20px', width: '100%', maxWidth: '300px' }}>
                                            {t('Nuevo_pedido')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {seccionActiva === 'menu' && (
                    <div className="vb-footer-actions">
                         <div style={{ display: 'flex', gap: '10px' }}>
                            <button 
                                className="vb-btn-voz" 
                                onClick={iniciarEscuchaVoz}
                                style={{ flex: 1, marginTop: 0, justifyContent: 'center', padding: '12px 5px', fontSize: '14px' }}
                            >
                                <span className="material-symbols-outlined">mic</span> {t('Pedir_voz')}
                            </button>
                             {carrito.length > 0 && (
                                <button className="vb-btn-carrito" onClick={() => setSeccionActiva('pedido')} style={{ flex: 2 }}>
                                    <span className="material-symbols-outlined">shopping_basket</span>
                                    {t('VER_MI_PEDIDO', {total: totalPrecioCarrito.toFixed(2)})}
                                </button>
                            )}
                        </div>
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
                            {productoModal.prod.img && productoModal.prod.img !== "" && <img src={productoModal.prod.img} alt="" />}
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
                                                        <div className="vb-radio-custom">
                                                            {isSelected && <div className="vb-radio-dot"></div>}
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