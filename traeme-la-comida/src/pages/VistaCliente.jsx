import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import './VistaCliente.css';
import { getMenuCliente } from '../services/apiMenuManager';
import {
    submitOrder,
    getMesaByUuid,
    solicitarPago as solicitarPagoApi,
    llamarCamarero as llamarCamareroApi,
    getPedidoActivo,
    getDetallesPedido,
    registrarPago,
    actualizarEstadoDetalle,
    finalizarPedido
} from '../services/apiCliente';
import { getConfiguracionLocal } from '../services/apiAuth';
import { useCustomModal } from '../components/useCustomModal';
import { useTranslation, Trans } from 'react-i18next';
import LanguageSelector from '../components/LanguageSelector';
import { voiceService } from '../services/voiceService';
import { StripePaymentModal } from '../components/StripePaymentModal';

const VistaCliente = () => {
    const { t } = useTranslation();

    const formatUrl = (url) => {
        if (!url) return '';
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        return `https://${url}`;
    };
    const { showAlert, showConfirm, ModalComponent } = useCustomModal();
    const { uuid } = useParams();
    const [mesa, setMesa] = useState(null);
    const [mesaError, setMesaError] = useState(false);

    const [seccionActiva, setSeccionActiva] = useState('menu');
    const [filtroActivo, setFiltroActivo] = useState('Todo');
    const [carrito, setCarrito] = useState(() => {
        try {
            const saved = sessionStorage.getItem('traeme_carrito_cliente');
            if (saved) return JSON.parse(saved);
        } catch (e) {}
        return [];
    });
    const [camareroLlamado, setCamareroLlamado] = useState(false);
    const [metodoPagoMesa, setMetodoPagoMesa] = useState('cash');

    const [menuData, setMenuData] = useState([]);
    const [cargandoMenu, setCargandoMenu] = useState(true);

    const [productoModal, setProductoModal] = useState(null);
    const [opcionesElegidas, setOpcionesElegidas] = useState({});
    const [notaOpcional, setNotaOpcional] = useState("");

    const [modalPago, setModalPago] = useState(null);
    const [modalDivisionPago, setModalDivisionPago] = useState(null); // { metodo }
    const [tipoDivision, setTipoDivision] = useState('todo');
    const [itemsSeleccionadosPago, setItemsSeleccionadosPago] = useState([]);
    const [modoSeleccionPago, setModoSeleccionPago] = useState(false);
    const [metodoDivisionActivo, setMetodoDivisionActivo] = useState(null);
    const [stripeModalOpen, setStripeModalOpen] = useState(false);
    const [montoStripe, setMontoStripe] = useState(0);
    const [indicesStripe, setIndicesStripe] = useState([]);

    const [estadoVoz, setEstadoVoz] = useState(null);
    const [mensajeVoz, setMensajeVoz] = useState("");
    const [busqueda, setBusqueda] = useState("");

    const [configNegocio, setConfigNegocio] = useState({ nombre_local: 'Cargando...', logo_url: null });

    useEffect(() => {
        try {
            const localItems = carrito.filter(c => !c.enviado);
            if (localItems.length > 0) {
                sessionStorage.setItem('traeme_carrito_cliente', JSON.stringify(localItems));
            } else {
                sessionStorage.removeItem('traeme_carrito_cliente');
            }
        } catch(e) {}
    }, [carrito]);

    useEffect(() => {
        const resolveMesa = async () => {
            try {
                const data = await getMesaByUuid(uuid);
                setMesa(data);
            } catch {
                setMesaError(true);
            }
        };
        if (uuid) resolveMesa();
    }, [uuid]);

    useEffect(() => {
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

        // POLL MENU EVERY 15 SECONDS FOR STOCK SYNC
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

    // HYDRATION & POLLING: FETCH ACTIVE ORDER AND MONITOR STATUS
    useEffect(() => {
        if (!mesa || !mesa.id) return;

        const hydrateAndPollStatus = async () => {
            try {
                const pedido = await getPedidoActivo(mesa.id);

                // Si ya no hay pedido activo, pero teníamos items enviados pendientes de pago,
                // significa que el camarero ha cerrado la mesa y la cuenta ha sido saldada.
                if (!pedido) {
                    setCarrito(prev => {
                        const hayPendientesDeCierre = prev.some(item => item.enviado && item.estadoPago !== 'pagado');
                        if (hayPendientesDeCierre) {
                            // IMPORTANTE: Solo marcamos como pagados los que ya estaban enviados
                            return prev.map(item => item.enviado ? { ...item, estadoPago: 'pagado' } : item);
                        }
                        return prev;
                    });
                    return;
                }

                // Si hay pedido, hidratamos o actualizamos estados
                const detalles = await getDetallesPedido(pedido.id);
                if (detalles && detalles.length > 0) {
                    const newCarrito = detalles.map(det => ({
                        id_detalle: det.id,
                        producto: { id: det.id_producto, nombre: det.producto?.nombre || 'Producto', precio: det.precio_unitario },
                        nombre: det.producto?.nombre || 'Producto',
                        precioFinal: det.precio_unitario,
                        extrasAplicados: det.seleccionesOpciones?.map(sel => ({
                            opcionSeleccionada: { id: sel.id_opcion, nombre: sel.opcion?.nombre || '', suplemento: sel.precio_extra_aplicado }
                        })) || [],
                        nota: det.notas,
                        enviado: true,
                        estadoPago: det.estado === 'pagado' ? 'pagado' : (det.estado === 'solicitado_mesa' ? 'solicitado_mesa' : null),
                        estado: det.estado
                    }));
                    // MERGE LOGIC: Keep local items (not sent) and replace sent items with fresh DB state
                    setCarrito(prev => {
                        const localItems = prev.filter(item => !item.enviado);
                        return [...localItems, ...newCarrito];
                    });
                }
            } catch (err) {
                console.error("Error polling order status:", err);
            }
        };

        hydrateAndPollStatus();
        const statusInterval = setInterval(hydrateAndPollStatus, 5000);
        return () => clearInterval(statusInterval);
    }, [mesa]);

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
        const seleccionesIniciales = {};
        // LEYENDO LOS CAMPOS DE LA RELACIÓN DEL PRODUCTO
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
                    showAlert(t('max_opciones_alert', { max }), 'warning');
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
        // VALIDANDO MIN Y MAX EXTRAIDOS DE LA DB
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
            enviado: false,
            estadoPago: null
        }]);
        setProductoModal(null);
    };

    const eliminarDelCarrito = (indexAEliminar) => {
        setCarrito(carrito.filter((_, index) => index !== indexAEliminar));
    };

    const enviarACocina = async () => {
        const itemsPorEnviar = carrito.filter(item => !item.enviado);
        if (itemsPorEnviar.length === 0) return;

        if (!mesa) {
            showAlert(t('Error_mesa_no_identificada'), 'error');
            return;
        }

        try {
            await submitOrder(mesa.id, false, null, itemsPorEnviar);

            const carritoEnviado = carrito.map(item => ({ ...item, enviado: true }));
            setCarrito(carritoEnviado);
            showAlert(t('Pedido_enviado_cocina'), 'success');
        } catch (error) {
            console.error('Error al enviar pedido:', error);
            showAlert(t('Error_enviar_pedido'), 'error');
        }
    };

    const llamarAlCamarero = async () => {
        if (!camareroLlamado && await showConfirm(t('Confirm_llamar_camarero'))) {
            try {
                if (mesa) await llamarCamareroApi(mesa.id);
                setCamareroLlamado(true);
            } catch (err) {
                console.error("Error llamando al camarero:", err);
            }
        }
    };

    const iniciarPago = (metodo, itemsIndices = []) => {
        // Mapeo a strings específicas del Enum de la Base de Datos
        let metodoEnum = 'Efectivo';
        if (metodo === 'bizum' || metodo === 'Bizum') metodoEnum = 'Bizum';
        else if (metodo === 'gpay' || metodo === 'GooglePay') metodoEnum = 'GooglePay';
        else if (metodo === 'card' || metodo === 'Tarjeta') metodoEnum = 'Tarjeta';
        else if (metodo === 'stripe' || metodo === 'Stripe') metodoEnum = 'Stripe';
        else if (metodo === 'mesa') {
            metodoEnum = metodoPagoMesa === 'card' ? 'Tarjeta' : 'Efectivo';
        }

        const indicesPagables = (itemsIndices && itemsIndices.length > 0)
            ? itemsIndices
            : (modoSeleccionPago ? itemsSeleccionadosPago : carrito
                .map((item, index) => ({ item, index }))
                .filter(({ item }) => item.enviado && !item.estadoPago)
                .map(({ index }) => index));

        if (indicesPagables.length === 0) {
            showAlert(t('No_hay_articulos', 'No hay artículos seleccionados o artículos pendientes de pago.'), "warning");
            return;
        }

        if (!modoSeleccionPago && !itemsIndices.length) {
            setMetodoDivisionActivo(metodoEnum);
            setModalDivisionPago({ metodo: metodoEnum });
            return;
        }

        const esDigital = metodoEnum.toLowerCase() === 'bizum' || metodoEnum.toLowerCase().includes('google') || metodoEnum.toLowerCase().includes('gpay') || metodoEnum.toLowerCase() === 'stripe';
        if (!esDigital) {
            ejecutarPagoMesa(indicesPagables, metodoEnum);
        } else {
            ejecutarPagoDigital(indicesPagables, metodoEnum);
        }
    };

    const ejecutarPagoMesa = async (indices, metodo = 'Efectivo') => {
        const monto = indices.reduce((acc, i) => acc + carrito[i].precioFinal, 0);
        const nuevoCarrito = carrito.map((item, index) => {
            if (indices.includes(index)) {
                return { ...item, estadoPago: 'solicitado_mesa' };
            }
            return item;
        });
        setCarrito(nuevoCarrito);

        if (mesa) {
            try {
                const pedido = await getPedidoActivo(mesa.id);
                if (pedido) {
                    // ELIMINADO: registrarPago. Ahora solo el camarero registra los pagos físicos para evitar duplicados.
                    await solicitarPagoApi(mesa.id, metodo);

                    // Marcar los detalles como 'solicitado_mesa' en DB con el método específico
                    for (const i of indices) {
                        const item = carrito[i];
                        if (item.id_detalle) {
                            await actualizarEstadoDetalle(item.id_detalle, 'solicitado_mesa', metodo);
                        }
                    }
                }
            } catch (err) {
                console.error("Error solicitando pago:", err);
            }
        }
        setItemsSeleccionadosPago([]);
        setModoSeleccionPago(false);
    };

    const ejecutarPagoDigital = async (indices, metodo) => {
        const monto = indices.reduce((acc, i) => acc + carrito[i].precioFinal, 0);

        if (metodo === 'Stripe' || metodo === 'Tarjeta' || metodo === 'bizum' || metodo === 'Bizum' || metodo === 'gpay' || metodo === 'GooglePay' || metodo === 'Google Pay') {
             // For any digital method, wrap all in our modern Stripe overlay!
             setIndicesStripe(indices);
             setMontoStripe(monto);
             setStripeModalOpen(true);
             return;
        }
        await procesarPagoDigitalFinal(indices, metodo, monto);
    };

    const procesarPagoDigitalFinal = async (indices, metodo, monto) => {
        const nuevoCarrito = carrito.map((item, index) => {
            if (indices.includes(index)) {
                return { ...item, estadoPago: 'pagado' };
            }
            return item;
        });
        setCarrito(nuevoCarrito);

        if (mesa) {
            try {
                const pedido = await getPedidoActivo(mesa.id);
                if (pedido) {
                    await registrarPago(pedido.id, monto, metodo);

                    // MARCAMOS LOS DETALLES COMO PAGADOS EN EL BACKEND
                    for (const i of indices) {
                        const item = carrito[i];
                        if (item.id_detalle) {
                            await actualizarEstadoDetalle(item.id_detalle, 'pagado', metodo);
                        }
                    }

                    // Si se ha pagado todo el pedido, lo cerramos
                    const nuevoCarritoTemp = carrito.map((it, idx) => indices.includes(idx) ? { ...it, estadoPago: 'pagado' } : it);
                    if (nuevoCarritoTemp.every(it => it.estadoPago === 'pagado')) {
                        await finalizarPedido(pedido.id, mesa.id);
                        if (configNegocio.link_resenas_google) {
                            setTimeout(async () => {
                                if (await showConfirm(t("Review_google_title"), t("Review_google_desc"), t("Review_google_yes"), t("Review_google_no"))) {
                                    window.open(formatUrl(configNegocio.link_resenas_google), '_blank');
                                }
                            }, 500);
                        }
                    }
                }
            } catch (err) {
                console.error("Error al registrar pago digital:", err);
            }
        }
        setItemsSeleccionadosPago([]);
        setModoSeleccionPago(false);
    };


    const confirmarPagoFinal = async () => {
        // Esta función queda por compatibilidad si se abren otros modales futuros
        const nuevoCarrito = carrito.map((item, index) => {
            if (itemsSeleccionadosPago.includes(index)) {
                return {
                    ...item,
                    estadoPago: (modalPago === 'bizum' || modalPago === 'gpay') ? 'pagado' : 'solicitado_mesa'
                };
            }
            return item;
        });

        setCarrito(nuevoCarrito);

        if (modalPago === 'mesa' && mesa) {
            try {
                await solicitarPagoApi(mesa.id);
            } catch (err) {
                console.error("Error solicitando pago:", err);
            }
        }

        setModalPago(null);
        setItemsSeleccionadosPago([]);
    };

    const simularCobroCamarero = async () => {
        const nuevoCarrito = carrito.map(item => {
            if (item.estadoPago === 'solicitado_mesa') {
                return { ...item, estadoPago: 'pagado' };
            }
            return item;
        });
        setCarrito(nuevoCarrito);

        if (nuevoCarrito.every(item => item.estadoPago === 'pagado')) {
            const pedido = await getPedidoActivo(mesa.id);
            if (pedido) {
                await finalizarPedido(pedido.id, mesa.id);
                if (configNegocio.link_resenas_google) {
                    setTimeout(async () => {
                        if (await showConfirm("Para nosotros es muy importante tu opinión, ¿Nos ayudas con una reseña en Google?", "¡Gracias por tu visita!", "Claro que sí", "En otro momento")) {
                            window.open(formatUrl(configNegocio.link_resenas_google), '_blank');
                        }
                    }, 500);
                }
            }
        }
    };

    const iniciarEscuchaVoz = async () => {
        console.log("User: Pulsó botón de voz (Modo Universal)");
        try {
            setEstadoVoz('escuchando');
            setMensajeVoz(t('Escuchando_voz'));
            await voiceService.startRecording(() => detenerEscuchaVoz());
        } catch (err) {
            console.error("Error al iniciar grabación universal:", err);
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
                console.log("Universal Speech: Transcripción:", transcript);
                
                if (transcript && transcript.trim().length > 0) {
                    analizarPedidoVoz(transcript);
                } else {
                    throw new Error("Transcripción vacía");
                }
            } catch (err) {
                console.error("Error en flujo de voz universal:", err);
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
                // Si solo hay un item, usamos el mensaje de confirmación simple, si no el múltiple
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
            console.error("Error en analizarPedidoVoz:", err);
            setEstadoVoz('error');
            setMensajeVoz(t('Algo_salio_mal'));
            setTimeout(() => setEstadoVoz(null), 3000);
        }
    };

    const totalPrecioCarrito = carrito.reduce((acc, item) => acc + item.precioFinal, 0);
    const totalPendientePago = carrito.filter(item => !item.estadoPago).reduce((acc, item) => acc + item.precioFinal, 0);
    const totalEsperandoMesa = carrito.filter(item => item.estadoPago === 'solicitado_mesa').reduce((acc, item) => acc + item.precioFinal, 0);
    const totalPagoSeleccionado = itemsSeleccionadosPago.reduce((acc, i) => acc + carrito[i].precioFinal, 0);
    const todosPagados = carrito.length > 0 && carrito.every(item => item.estadoPago === 'pagado');

    if (mesaError) {
        return (
            <div className="vista-cliente-wrapper" style={{ alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '64px', color: '#ef4444' }}>qr_code_scanner</span>
                    <h2 style={{ color: '#1e293b', marginTop: '16px' }}>{t('QR_no_valido')}</h2>
                    <p style={{ color: '#64748b', maxWidth: '280px', margin: '8px auto 0' }}>
                        Este código QR ha caducado o no existe. Por favor, escanea el QR que hay sobre tu mesa.
                    </p>
                </div>
            </div>
        );
    }

    if (cargandoMenu) {
        return (
            <div className="vista-cliente-wrapper" style={{ alignItems: 'center' }}>
                <div style={{ textAlign: 'center', color: 'var(--primary)' }}>
                    <span className="material-symbols-outlined vc-icon-spin" style={{ fontSize: '40px' }}>autorenew</span>
                    <p style={{ fontWeight: 'bold' }}>{t('Cargando_carta')}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="vista-cliente-wrapper">
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;800&display=swap" rel="stylesheet" />
            <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet" />

            <div className={`vista-cliente-container ${(productoModal || estadoVoz) ? 'no-scroll' : ''}`}>
                <header className="vc-header">
                    <div className="vc-header-icon">
                        {configNegocio.logo_url && configNegocio.logo_url !== "" ? (
                            <img src={configNegocio.logo_url} alt="Logo" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                            <span className="material-symbols-outlined">restaurant</span>
                        )}
                    </div>
                    <h2>{configNegocio.nombre_local}</h2>
                    <LanguageSelector />
                </header>

                <nav className="vc-nav">
                    <span
                        className={`vc-nav-link ${seccionActiva === 'menu' ? 'active' : ''}`}
                        onClick={() => setSeccionActiva('menu')}
                    > {t('MENU')} </span>
                    <span
                        className={`vc-nav-link ${seccionActiva === 'pedido' ? 'active' : ''}`}
                        onClick={() => setSeccionActiva('pedido')}
                    >
                        {t('MI PEDIDO')} {carrito.filter(i => !i.estadoPago).length > 0 && <div className="vc-badge-nav">{carrito.filter(i => !i.estadoPago).length}</div>}
                    </span>
                </nav>

                {seccionActiva === 'menu' ? (
                    <div className="vc-page-content">
                        <section className="vc-banner">
                            <div className="vc-banner-text" style={{ flex: 1 }}>
                                <h1>{t('Empieza_manana')}</h1>
                                <p>{t('Empieza_manana_desc')}</p>
                                <div className="vc-search-container">
                                    <span className="material-symbols-outlined vc-search-icon">search</span>
                                    <input
                                        type="text"
                                        placeholder={t('Buscar_platos', 'Buscar platos...')}
                                        className="vc-search-input"
                                        value={busqueda}
                                        onChange={(e) => setBusqueda(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="vc-banner-img"></div>
                        </section>

                        <div className="vc-categories no-scrollbar">
                            {categoriasTabs.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setFiltroActivo(cat)}
                                    className={`vc-cat-btn ${filtroActivo === cat ? 'active' : ''}`}
                                >
                                    {t(cat)}
                                </button>
                            ))}
                        </div>

                        <div className="vc-product-list">
                            {(() => {
                                const productosFiltrados = menuData
                                    .filter(cat => filtroActivo === 'Todo' || cat.nombre === filtroActivo)
                                    .flatMap(cat => cat.productos
                                        .filter(prod => {
                                            const queryNormalizada = normalizarTexto(busqueda);
                                            if (!queryNormalizada) return true;

                                            const nombreOriginalNorm = normalizarTexto(prod.nombre);
                                            const nombreTradNorm = normalizarTexto(t(prod.nombre));
                                            const descOriginalNorm = normalizarTexto(prod.desc || "");
                                            const descTradNorm = normalizarTexto(t(prod.desc || ""));

                                            return nombreOriginalNorm.includes(queryNormalizada) || 
                                                   nombreTradNorm.includes(queryNormalizada) ||
                                                   descOriginalNorm.includes(queryNormalizada) ||
                                                   descTradNorm.includes(queryNormalizada);
                                        })
                                        .map(prod => ({ prod, cat }))
                                    );

                                if (productosFiltrados.length === 0) {
                                    return (
                                        <div className="vc-no-results">
                                            <span className="material-symbols-outlined">search_off</span>
                                            <p>{t('No_resultados_busqueda', 'No hemos encontrado platos que coincidan')}</p>
                                        </div>
                                    );
                                }

                                return productosFiltrados.map(({ prod, cat }) => (
                                    <div key={prod.id} className="vc-card" onClick={() => abrirModalProducto(prod, cat)}>
                                        {prod.img && prod.img !== "" && <img src={prod.img} className="vc-card-img" alt={prod.nombre} />}
                                        <div className="vc-card-info">
                                            <h4>{t(prod.nombre)}</h4>
                                            <p className="vc-card-desc">{t(prod.desc)}</p>
                                            <div className="vc-card-footer">
                                                <span className="vc-price">{prod.precio.toFixed(2)}€</span>
                                                <div className="vc-card-actions">
                                                    <button className="vc-btn-add">
                                                        <span className="material-symbols-outlined">add</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>
                    </div>
                ) : (
                    <div className="vc-page-content">
                        <h2 className="vc-section-title">{t('Tu_Pedido')}</h2>
                        {carrito.length === 0 ? (
                            <div className="vc-empty-cart">
                                <p>{t('Tu_carrito_vacio')}</p>
                                <button onClick={() => setSeccionActiva('menu')} className="vc-btn-text">{t('Volver_a_carta')}</button>
                            </div>
                        ) : (
                            <div>
                                <div className="vc-cart-list">
                                    {carrito.map((item, i) => (
                                        <div key={i} className={`vc-pedido-item ${item.estadoPago ? 'enviado' : (item.enviado ? 'enviado' : '')}`}>
                                            <div className="vc-pedido-content">
                                                <div className="vc-pedido-header">
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
                                                        {modoSeleccionPago && item.enviado && !item.estadoPago && (
                                                            <input
                                                                type="checkbox"
                                                                checked={itemsSeleccionadosPago.includes(i)}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setItemsSeleccionadosPago([...itemsSeleccionadosPago, i]);
                                                                    } else {
                                                                        setItemsSeleccionadosPago(itemsSeleccionadosPago.filter(idx => idx !== i));
                                                                    }
                                                                }}
                                                                className="vc-checkbox-pago"
                                                            />
                                                        )}
                                                        <div style={{ flex: 1 }}>
                                                            <span className="vc-pedido-name">
                                                                {t(item.nombre)}
                                                                {item.estadoPago === 'pagado' ? (
                                                                    <small style={{ color: '#34a853', marginLeft: '5px' }}>{t('PAGADO_badge')}</small>
                                                                ) : item.estadoPago === 'solicitado_mesa' ? (
                                                                    <small style={{ color: '#3b82f6', marginLeft: '5px' }}>{t('ESPERANDO_COBRO_badge')}</small>
                                                                ) : item.estado === 'servido' ? (
                                                                    <small style={{ color: '#0ea5e9', marginLeft: '5px' }}>{t('SERVIDO_badge')}</small>
                                                                ) : (
                                                                    item.enviado && <small style={{ color: 'var(--primary)', marginLeft: '5px' }}>{t('EN_COCINA_badge')}</small>
                                                                )}
                                                            </span>
                                                            <span className="vc-pedido-price">{item.precioFinal.toFixed(2)}€</span>
                                                        </div>
                                                    </div>
                                                    {!item.enviado && !item.estadoPago && !modoSeleccionPago && (
                                                        <button className="vc-btn-eliminar" onClick={() => eliminarDelCarrito(i)}>
                                                            <span className="material-symbols-outlined">close</span>
                                                        </button>
                                                    )}
                                                </div>

                                                {item.extrasAplicados?.length > 0 && (
                                                    <div className="vc-pedido-opciones">
                                                        {item.extrasAplicados.map((opt, idx) => (
                                                            <span key={idx} className="vc-pedido-badge-opt">
                                                                {t(opt.opcionSeleccionada.nombre)} {opt.opcionSeleccionada.suplemento > 0 && `(+${opt.opcionSeleccionada.suplemento.toFixed(2)}€)`}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}

                                                {item.nota && (
                                                    <div className="vc-pedido-nota">
                                                        <p>📝 {item.nota}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="vc-total-card">
                                    <div className="vc-total-header">
                                        <span>{t('Total_Cuenta')}</span>
                                        <span className="vc-total-amount">{totalPrecioCarrito.toFixed(2)}€</span>
                                    </div>
                                    {totalPendientePago > 0 && totalPendientePago !== totalPrecioCarrito && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontWeight: 'bold', marginTop: '10px' }}>
                                            <span>{t('Pendiente_pago')}</span>
                                            <span style={{ color: 'var(--primary)' }}>{totalPendientePago.toFixed(2)}€</span>
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                                        {modoSeleccionPago ? (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        const m = metodoDivisionActivo || (metodoPagoMesa === 'card' ? 'Tarjeta' : 'Efectivo');
                                                        iniciarPago(m, itemsSeleccionadosPago);
                                                    }}
                                                    className="vc-btn-carrito btn-dark"
                                                    disabled={itemsSeleccionadosPago.length === 0}
                                                    style={{ backgroundColor: '#1e293b' }}
                                                >
                                                    {t('pagar_seleccion')} ({itemsSeleccionadosPago.reduce((acc, idx) => acc + carrito[idx].precioFinal, 0).toFixed(2)}€)
                                                </button>
                                                <button onClick={() => { setModoSeleccionPago(false); setItemsSeleccionadosPago([]); }} className="vc-btn-text">
                                                    {t('Cancelar_seleccion')}
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                {carrito.some(item => !item.enviado) && (
                                                    <button onClick={enviarACocina} className="vc-btn-carrito btn-dark">
                                                        {t('Enviar_cocina')}
                                                    </button>
                                                )}

                                                {!todosPagados && (
                                                    <button onClick={() => setSeccionActiva('menu')} className="vc-btn-carrito btn-orange">
                                                        <span className="material-symbols-outlined" style={{ marginRight: '5px' }}>add_circle</span>
                                                        {t('Anadir_mas_cosas')}
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>

                                {totalEsperandoMesa > 0 && (
                                    <div className="vc-pago-card" style={{ borderColor: '#bfdbfe', backgroundColor: '#eff6ff', marginTop: '30px', textAlign: 'center' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#3b82f6', fontSize: '48px', marginBottom: '10px' }}>hourglass_top</span>
                                        <h3 style={{ color: '#1e293b', marginBottom: '5px' }}>{t('Camarero_camino')}</h3>
                                        <p style={{ color: '#64748b', margin: '0', fontSize: '14px' }}>
                                            <Trans i18nKey="Camarero_camino_desc" values={{ total: totalEsperandoMesa.toFixed(2) }}>Prepara <strong>{totalEsperandoMesa.toFixed(2)}€</strong> para abonar en la mesa.</Trans>
                                        </p>
                                    </div>
                                )}

                                {totalPendientePago > 0 ? (
                                    <div className="vc-pago-grid">
                                        <div className="vc-pago-card">
                                            <div className="vc-pago-header">
                                                <span className="material-symbols-outlined icon-orange">payments</span>
                                                <h3>{t('Pagar_ahora_digital')}</h3>
                                            </div>
                                            <button className="vc-btn-digital" onClick={() => iniciarPago('stripe')}>
                                                <div className="vc-digital-info">
                                                    <span className="material-symbols-outlined icon-gpay" style={{color: '#6772E5'}}>credit_card</span>
                                                    <span>Pago Seguro Online (Stripe)</span>
                                                </div>
                                                <span className="material-symbols-outlined text-muted">chevron_right</span>
                                            </button>
                                        </div>

                                        <div className="vc-pago-card">
                                            <div className="vc-pago-header">
                                                <span className="material-symbols-outlined icon-orange">restaurant_menu</span>
                                                <h3>{t('Pagar_en_mesa')}</h3>
                                            </div>
                                            <div className="vc-radio-group">
                                                <div className={`vc-radio-box ${metodoPagoMesa === 'cash' ? 'active' : ''}`} onClick={() => setMetodoPagoMesa('cash')}>
                                                    <span className="material-symbols-outlined">payments</span>
                                                    <span>{t('Efectivo_titulo')}</span>
                                                </div>
                                                <div className={`vc-radio-box ${metodoPagoMesa === 'card' ? 'active' : ''}`} onClick={() => setMetodoPagoMesa('card')}>
                                                    <span className="material-symbols-outlined">credit_card</span>
                                                    <span>{t('Tarjeta_titulo')}</span>
                                                </div>
                                            </div>
                                            <button className="vc-btn-carrito btn-dark" onClick={() => iniciarPago('mesa')}>
                                                <span className="material-symbols-outlined">notifications_active</span>
                                                {t('solicitar_cobro')}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    todosPagados && (
                                        <div className="vc-pago-card vc-success-card">
                                            <span className="material-symbols-outlined icon-success">check_circle</span>
                                            <h3>{t('Cuenta_saldada')}</h3>
                                            <p>{t('Cuenta_saldada_desc')}</p>
                                        </div>
                                    )
                                )}
                            </div>
                        )}
                    </div>
                )}

                {seccionActiva === 'menu' && (
                    <div className="vc-footer-actions">
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                className={`vc-btn-camarero ${camareroLlamado ? 'llamado' : ''}`}
                                onClick={llamarAlCamarero}
                                style={{ flex: 1, padding: '12px 5px', fontSize: '14px' }}
                            >
                                <span className="material-symbols-outlined">{camareroLlamado ? 'done' : 'notifications'}</span>
                                {camareroLlamado ? t('Camarero_llamado') : t('Llamar_camarero')}
                            </button>
                            <button 
                                className="vc-btn-voz" 
                                onClick={iniciarEscuchaVoz}
                                style={{ flex: 1, marginTop: 0, justifyContent: 'center', padding: '12px 5px', fontSize: '14px' }}
                            >
                                <span className="material-symbols-outlined">mic</span> {t('Pedir_voz')}
                            </button>
                        </div>
                        {carrito.length > 0 && (
                            <button className="vc-btn-carrito" onClick={() => setSeccionActiva('pedido')}>
                                <span className="material-symbols-outlined">shopping_basket</span>
                                {t('VER_MI_PEDIDO', { total: totalPrecioCarrito.toFixed(2) })}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* MODAL DE PRODUCTO */}
            {productoModal && (
                <>
                    <div className="vc-modal-backdrop" onClick={() => setProductoModal(null)}></div>
                    <div className="vc-product-sheet">
                        <button className="vc-sheet-close" onClick={() => setProductoModal(null)}>
                            <span className="material-symbols-outlined">close</span>
                        </button>

                        <div className="vc-sheet-header">
                            {productoModal.prod.img && productoModal.prod.img !== "" && <img src={productoModal.prod.img} alt="" />}
                            <div className="vc-sheet-title">
                                <h3>{t(productoModal.prod.nombre)}</h3>
                                <p>{t(productoModal.prod.desc)}</p>
                                <span className="vc-sheet-price">{productoModal.prod.precio.toFixed(2)}€ {t('base')}</span>
                            </div>
                        </div>

                        <div className="vc-sheet-content">
                            {productoModal.prod.gruposOpciones?.map(grupo => {
                                const numSeleccionadas = opcionesElegidas[grupo.id]?.length || 0;
                                const esValido = numSeleccionadas >= (grupo.min_selecciones || 0) && numSeleccionadas <= (grupo.max_selecciones || 100);

                                return (
                                    <div key={grupo.id} className="vc-option-group">
                                        <h4 className="vc-group-title">
                                            {t(grupo.nombre)}
                                            {grupo.min_selecciones > 0 ? (
                                                <span className={`vc-req-badge ${esValido ? 'valido' : 'pendiente'}`}>
                                                    {numSeleccionadas < grupo.min_selecciones
                                                        ? t('Selecciona_al_menos', { min: grupo.min_selecciones })
                                                        : t('Minimo_cumplido', { count: numSeleccionadas })}
                                                </span>
                                            ) : (
                                                <span className="vc-opt-badge">{t('Opcional_max', { max: grupo.max_selecciones })}</span>
                                            )}
                                        </h4>
                                        <div className="vc-options-list">
                                            {grupo.opciones.map(opcion => {
                                                const isSelected = opcionesElegidas[grupo.id]?.some(o => o.id === opcion.id);
                                                return (
                                                    <div
                                                        key={opcion.id}
                                                        className={`vc-option-row ${isSelected ? 'selected' : ''}`}
                                                        onClick={() => manejarSeleccionOpcion(grupo.id, opcion, grupo.max_selecciones)}
                                                    >
                                                        <div className="vc-radio-custom">
                                                            {isSelected && <div className="vc-radio-dot"></div>}
                                                        </div>
                                                        <span className="vc-option-name">{t(opcion.nombre)}</span>
                                                        {opcion.suplemento > 0 && (
                                                            <span className="vc-option-sup">+{opcion.suplemento.toFixed(2)}€</span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}

                            <div className="vc-option-group">
                                <h4 className="vc-group-title">{t('Notas_adicionales')}</h4>
                                <textarea
                                    className="vc-textarea-notes"
                                    placeholder={t('Ejemplo_notas')}
                                    value={notaOpcional}
                                    onChange={(e) => setNotaOpcional(e.target.value)}
                                ></textarea>
                            </div>
                        </div>

                        <div className="vc-sheet-footer">
                            <button
                                className={`vc-btn-carrito ${!validarSelecciones() ? 'disabled' : ''}`}
                                onClick={confirmarAgregarAlCarrito}
                                disabled={!validarSelecciones()}
                            >
                                {validarSelecciones()
                                    ? t('Anadir_carrito_btn', { precio: calcularPrecioFinalItem().toFixed(2) })
                                    : t('Completa_opciones')}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* MODAL DE VOZ */}
            {estadoVoz && (
                <div className="vc-voz-overlay">
                    <div className="vc-voz-content">
                        {estadoVoz === 'escuchando' && (
                            <>
                                <h2>{mensajeVoz}</h2>
                                <div className="vc-mic-pulse-container" onClick={detenerEscuchaVoz}>
                                    <div className="pulse-ring"></div>
                                    <div className="pulse-ring delay"></div>
                                    <span className="material-symbols-outlined mic-icon">mic</span>
                                </div>
                                <p className="vc-voz-hint">{t('Hint_voz')}</p>
                                <button className="vc-btn-voz-close" onClick={cancelarVoz}>{t('Cancelar')}</button>
                            </>
                        )}
                        {estadoVoz === 'procesando' && (
                            <>
                                <span className="material-symbols-outlined vc-icon-spin">autorenew</span>
                                <h2>{mensajeVoz}</h2>
                                <p className="vc-voz-hint">{t('Hint_procesando')}</p>
                            </>
                        )}
                        {estadoVoz === 'exito' && (
                            <>
                                <span className="material-symbols-outlined vc-icon-success">check_circle</span>
                                <h2>{t('Pedido_realizado', 'Pedido realizado')}</h2>
                                <p className="vc-voz-hint">{mensajeVoz}</p>
                            </>
                        )}
                        {estadoVoz === 'error' && (
                            <>
                                <span className="material-symbols-outlined vc-icon-error">error</span>
                                <h2>{t('Mmm_no_lo_tengo_claro', 'Mmm... no lo tengo claro')}</h2>
                                <p className="vc-voz-hint">{mensajeVoz}</p>
                                <div className="vc-voz-error-actions">
                                    <button className="vc-btn-carrito" onClick={iniciarEscuchaVoz}>
                                        <span className="material-symbols-outlined">replay</span> Volver a intentar
                                    </button>
                                    <button className="vc-btn-text" onClick={cancelarVoz} style={{ marginTop: '15px' }}>
                                        Hacer pedido manual
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL PROFESIONAL DE DIVISIÓN DE PAGO */}
            {modalDivisionPago && (
                <>
                    <div className="vc-modal-backdrop" onClick={() => setModalDivisionPago(null)}></div>
                    <div className="vc-product-sheet" style={{ height: 'auto', paddingBottom: '30px' }}>
                        <div style={{ padding: '25px 20px', textAlign: 'center' }}>
                            <div style={{
                                width: '60px', height: '60px', backgroundColor: 'var(--primary-soft)', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px',
                                color: 'var(--primary)'
                            }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>payments</span>
                            </div>
                            <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#1e293b', marginBottom: '10px' }}>{t('Como_quieres_pagar', '¿Cómo quieres pagar?')}</h3>
                            <p style={{ color: '#64748b', fontSize: '15px', lineHeight: '1.5', marginBottom: '25px' }}>
                                {t("Como_quieres_pagar_desc", "Puedes pagar el total de la cuenta pendiente o seleccionar productos específicos para dividir el pago.")}
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <button
                                    onClick={async () => {
                                        const indices = carrito
                                            .map((item, index) => ({ item, index }))
                                            .filter(({ item }) => item.enviado && !item.estadoPago)
                                            .map(({ index }) => index);

                                        const m = modalDivisionPago.metodo;
                                        setModalDivisionPago(null);

                                        const esDigital = m.toLowerCase() === 'bizum' || m.toLowerCase().includes('google') || m.toLowerCase().includes('gpay') || m.toLowerCase() === 'stripe' || m.toLowerCase() === 'tarjeta';
                                        if (!esDigital) await ejecutarPagoMesa(indices, m);
                                        else await ejecutarPagoDigital(indices, m);
                                    }}
                                    style={{
                                        padding: '16px', borderRadius: '12px', border: 'none',
                                        backgroundColor: 'var(--primary)', color: 'white', fontWeight: 'bold',
                                        fontSize: '16px', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(236,146,19, 0.2)'
                                    }}
                                >
                                    {t('Pagar_todo', 'Pagar todo')} ({totalPendientePago.toFixed(2)}€)
                                </button>

                                <button
                                    onClick={() => {
                                        setModoSeleccionPago(true);
                                        setItemsSeleccionadosPago([]);
                                        setModalDivisionPago(null);
                                    }}
                                    style={{
                                        padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0',
                                        backgroundColor: 'white', color: '#1e293b', fontWeight: 'bold',
                                        fontSize: '16px', cursor: 'pointer'
                                    }}
                                >
                                    {t("Seleccionar_productos", "Seleccionar productos")}
                                </button>

                                <button
                                    onClick={() => setModalDivisionPago(null)}
                                    style={{
                                        marginTop: '10px', background: 'none', border: 'none',
                                        color: '#94a3b8', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer'
                                    }}
                                >
                                    {t("Cancelar", "Cancelar")}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            <StripePaymentModal 
                isOpen={stripeModalOpen} 
                monto={montoStripe} 
                onCancel={() => {
                    setStripeModalOpen(false);
                    setItemsSeleccionadosPago([]);
                    setModoSeleccionPago(false);
                }}
                onSuccess={() => {
                    setStripeModalOpen(false);
                    procesarPagoDigitalFinal(indicesStripe, 'Tarjeta', montoStripe);
                }}
            />

            <ModalComponent />
        </div>
    );
};

export default VistaCliente;