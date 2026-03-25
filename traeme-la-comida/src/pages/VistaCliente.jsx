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

const VistaCliente = () => {
    const { uuid } = useParams();
    const [mesa, setMesa] = useState(null);
    const [mesaError, setMesaError] = useState(false);

    const [seccionActiva, setSeccionActiva] = useState('menu');
    const [filtroActivo, setFiltroActivo] = useState('Todo');
    const [carrito, setCarrito] = useState([]);
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

    const [estadoVoz, setEstadoVoz] = useState(null);
    const [mensajeVoz, setMensajeVoz] = useState("");

    const [configNegocio, setConfigNegocio] = useState({ nombre_local: 'Cargando...', logo_url: null });

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
                         estadoPago: det.estado === 'pagado' ? 'pagado' : (det.estado === 'solicitado_mesa' ? 'solicitado_mesa' : null)
                     }));
                     // Solo actualizamos si hay cambios reales para evitar re-renders infinitos o pérdida de estado local efímero
                     setCarrito(newCarrito);
                }
            } catch (err) {
                console.error("Error polling order status:", err);
            }
        };

        hydrateAndPollStatus();
        const statusInterval = setInterval(hydrateAndPollStatus, 5000);
        return () => clearInterval(statusInterval);
    }, [mesa]);

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
        // VALIDANDO MIN Y MAX EXTRAIDOS DE LA DB
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
            alert('No se puede enviar el pedido: la mesa no ha sido identificada.');
            return;
        }

        try {
            await submitOrder(mesa.id, false, null, itemsPorEnviar);

            const carritoEnviado = carrito.map(item => ({ ...item, enviado: true }));
            setCarrito(carritoEnviado);
            alert('¡Pedido enviado a cocina!');
        } catch (error) {
            console.error('Error al enviar pedido:', error);
            alert('Hubo un error enviando tu pedido a cocina.');
        }
    };

    const llamarAlCamarero = async () => {
        if (!camareroLlamado && window.confirm("¿Deseas llamar al camarero?")) {
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
            alert("No hay artículos seleccionados o artículos pendientes de pago.");
            return;
        }

        if (!modoSeleccionPago && !itemsIndices.length) {
            setMetodoDivisionActivo(metodoEnum);
            setModalDivisionPago({ metodo: metodoEnum });
            return;
        }

        const esDigital = metodoEnum.toLowerCase() === 'bizum' || metodoEnum.toLowerCase().includes('google') || metodoEnum.toLowerCase().includes('gpay');
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
            }
        }
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
                setMensajeVoz("¡Entendido! Añadiendo Capuchino al pedido...");

                const prodSimulado = menuData.length > 0 ? menuData[0].productos[0] : null;

                if (prodSimulado) {
                    setCarrito(prev => [...prev, {
                        ...prodSimulado,
                        precioFinal: prodSimulado.precio,
                        opcionesAplicadas: [],
                        nota: "Pedido por voz asistente",
                        enviado: false,
                        estadoPago: null
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
    const totalPendientePago = carrito.filter(item => !item.estadoPago).reduce((acc, item) => acc + item.precioFinal, 0);
    const totalEsperandoMesa = carrito.filter(item => item.estadoPago === 'solicitado_mesa').reduce((acc, item) => acc + item.precioFinal, 0);
    const totalPagoSeleccionado = itemsSeleccionadosPago.reduce((acc, i) => acc + carrito[i].precioFinal, 0);
    const todosPagados = carrito.length > 0 && carrito.every(item => item.estadoPago === 'pagado');

    if (mesaError) {
        return (
            <div className="vista-cliente-wrapper" style={{ alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '64px', color: '#ef4444' }}>qr_code_scanner</span>
                    <h2 style={{ color: '#1e293b', marginTop: '16px' }}>QR no válido</h2>
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
                <div style={{ textAlign: 'center', color: '#ec9213' }}>
                    <span className="material-symbols-outlined vc-icon-spin" style={{ fontSize: '40px' }}>autorenew</span>
                    <p style={{ fontWeight: 'bold' }}>Cargando carta...</p>
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
                        {configNegocio.logo_url ? (
                            <img src={configNegocio.logo_url} alt="Logo" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                            <span className="material-symbols-outlined">restaurant</span>
                        )}
                    </div>
                    <h2>{configNegocio.nombre_local}</h2>
                </header>

                <nav className="vc-nav">
                    <span
                        className={`vc-nav-link ${seccionActiva === 'menu' ? 'active' : ''}`}
                        onClick={() => setSeccionActiva('menu')}
                    >
                        MENÚ
                    </span>
                    <span
                        className={`vc-nav-link ${seccionActiva === 'pedido' ? 'active' : ''}`}
                        onClick={() => setSeccionActiva('pedido')}
                    >
                        MI PEDIDO {carrito.filter(i => !i.estadoPago).length > 0 && <div className="vc-badge-nav">{carrito.filter(i => !i.estadoPago).length}</div>}
                    </span>
                </nav>

                {seccionActiva === 'menu' ? (
                    <div className="vc-page-content">
                        <section className="vc-banner">
                            <div className="vc-banner-text">
                                <h1>Empieza bien tu mañana</h1>
                                <p>Pide un desayuno fresco directamente desde tu mesa.</p>
                                <button className="vc-btn-voz" onClick={iniciarEscuchaVoz}>
                                    <span className="material-symbols-outlined">mic</span> Pedir por Voz
                                </button>
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
                                    {cat}
                                </button>
                            ))}
                        </div>

                        <div className="vc-product-list">
                            {menuData
                                .filter(cat => filtroActivo === 'Todo' || cat.nombre === filtroActivo)
                                .map(cat => cat.productos.map(prod => (
                                    <div key={prod.id} className="vc-card" onClick={() => abrirModalProducto(prod, cat)}>
                                        <img src={prod.img} className="vc-card-img" alt={prod.nombre} />
                                        <div className="vc-card-info">
                                            <h4>{prod.nombre}</h4>
                                            <p className="vc-card-desc">{prod.desc}</p>
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
                                )))}
                        </div>
                    </div>
                ) : (
                    <div className="vc-page-content">
                        <h2 className="vc-section-title">Tu Pedido</h2>
                        {carrito.length === 0 ? (
                            <div className="vc-empty-cart">
                                <p>Tu carrito está vacío.</p>
                                <button onClick={() => setSeccionActiva('menu')} className="vc-btn-text">Volver a la carta</button>
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
                                                                {item.nombre}
                                                                {item.estadoPago === 'pagado' ? (
                                                                    <small style={{ color: '#34a853', marginLeft: '5px' }}>✅ PAGADO</small>
                                                                ) : item.estadoPago === 'solicitado_mesa' ? (
                                                                    <small style={{ color: '#3b82f6', marginLeft: '5px' }}>⏳ ESPERANDO COBRO</small>
                                                                ) : (
                                                                    item.enviado && <small style={{ color: '#ec9213', marginLeft: '5px' }}>👨‍🍳 EN COCINA</small>
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
                                                                {opt.opcionSeleccionada.nombre} {opt.opcionSeleccionada.suplemento > 0 && `(+${opt.opcionSeleccionada.suplemento.toFixed(2)}€)`}
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
                                        <span>Total Cuenta</span>
                                        <span className="vc-total-amount">{totalPrecioCarrito.toFixed(2)}€</span>
                                    </div>
                                    {totalPendientePago > 0 && totalPendientePago !== totalPrecioCarrito && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontWeight: 'bold', marginTop: '10px' }}>
                                            <span>Pendiente de pago</span>
                                            <span style={{ color: '#ec9213' }}>{totalPendientePago.toFixed(2)}€</span>
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
                                                    PAGAR SELECCIÓN ({itemsSeleccionadosPago.reduce((acc, idx) => acc + carrito[idx].precioFinal, 0).toFixed(2)}€)
                                                </button>
                                                <button onClick={() => { setModoSeleccionPago(false); setItemsSeleccionadosPago([]); }} className="vc-btn-text">
                                                    Cancelar selección
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                {carrito.some(item => !item.enviado) && (
                                                    <button onClick={enviarACocina} className="vc-btn-carrito btn-dark">
                                                        ENVIAR PEDIDO A COCINA
                                                    </button>
                                                )}

                                                {!todosPagados && (
                                                    <button onClick={() => setSeccionActiva('menu')} className="vc-btn-carrito btn-orange">
                                                        <span className="material-symbols-outlined" style={{ marginRight: '5px' }}>add_circle</span>
                                                        AÑADIR MÁS COSAS
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>

                                {totalEsperandoMesa > 0 && (
                                    <div className="vc-pago-card" style={{ borderColor: '#bfdbfe', backgroundColor: '#eff6ff', marginTop: '30px', textAlign: 'center' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#3b82f6', fontSize: '48px', marginBottom: '10px' }}>hourglass_top</span>
                                        <h3 style={{ color: '#1e293b', marginBottom: '5px' }}>Camarero en camino</h3>
                                        <p style={{ color: '#64748b', margin: '0', fontSize: '14px' }}>
                                            Prepara <strong>{totalEsperandoMesa.toFixed(2)}€</strong> para abonar en la mesa.
                                        </p>
                                    </div>
                                )}

                                {totalPendientePago > 0 ? (
                                    <div className="vc-pago-grid">
                                        <div className="vc-pago-card">
                                            <div className="vc-pago-header">
                                                <span className="material-symbols-outlined icon-orange">payments</span>
                                                <h3>Pagar ahora (Digital)</h3>
                                            </div>
                                            <button className="vc-btn-digital" onClick={() => iniciarPago('bizum')}>
                                                <div className="vc-digital-info">
                                                    <div className="icon-bizum">BIZUM</div>
                                                    <span>Bizum</span>
                                                </div>
                                                <span className="material-symbols-outlined text-muted">chevron_right</span>
                                            </button>
                                            <button className="vc-btn-digital" onClick={() => iniciarPago('gpay')}>
                                                <div className="vc-digital-info">
                                                    <span className="material-symbols-outlined icon-gpay">google</span>
                                                    <span>Google Pay</span>
                                                </div>
                                                <span className="material-symbols-outlined text-muted">chevron_right</span>
                                            </button>
                                        </div>

                                        <div className="vc-pago-card">
                                            <div className="vc-pago-header">
                                                <span className="material-symbols-outlined icon-orange">restaurant_menu</span>
                                                <h3>Pagar en mesa</h3>
                                            </div>
                                            <div className="vc-radio-group">
                                                <div className={`vc-radio-box ${metodoPagoMesa === 'cash' ? 'active' : ''}`} onClick={() => setMetodoPagoMesa('cash')}>
                                                    <span className="material-symbols-outlined">payments</span>
                                                    <span>Efectivo</span>
                                                </div>
                                                <div className={`vc-radio-box ${metodoPagoMesa === 'card' ? 'active' : ''}`} onClick={() => setMetodoPagoMesa('card')}>
                                                    <span className="material-symbols-outlined">credit_card</span>
                                                    <span>Tarjeta</span>
                                                </div>
                                            </div>
                                            <button className="vc-btn-carrito btn-dark" onClick={() => iniciarPago('mesa')}>
                                                <span className="material-symbols-outlined">notifications_active</span>
                                                SOLICITAR COBRO
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    todosPagados && (
                                        <div className="vc-pago-card vc-success-card">
                                            <span className="material-symbols-outlined icon-success">check_circle</span>
                                            <h3>¡Cuenta saldada!</h3>
                                            <p>Todos los artículos han sido pagados. ¡Gracias por vuestra visita!</p>
                                        </div>
                                    )
                                )}
                            </div>
                        )}
                    </div>
                )}

                {seccionActiva === 'menu' && (
                    <div className="vc-footer-actions">
                        <button
                            className={`vc-btn-camarero ${camareroLlamado ? 'llamado' : ''}`}
                            onClick={llamarAlCamarero}
                        >
                            <span className="material-symbols-outlined">{camareroLlamado ? 'done' : 'notifications'}</span>
                            {camareroLlamado ? 'EL CAMARERO HA SIDO LLAMADO' : 'LLAMAR AL CAMARERO'}
                        </button>
                        {carrito.length > 0 && (
                            <button className="vc-btn-carrito" onClick={() => setSeccionActiva('pedido')}>
                                <span className="material-symbols-outlined">shopping_basket</span>
                                VER MI PEDIDO ({totalPrecioCarrito.toFixed(2)}€)
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
                            <img src={productoModal.prod.img} alt="" />
                            <div className="vc-sheet-title">
                                <h3>{productoModal.prod.nombre}</h3>
                                <p>{productoModal.prod.desc}</p>
                                <span className="vc-sheet-price">{productoModal.prod.precio.toFixed(2)}€ base</span>
                            </div>
                        </div>

                        <div className="vc-sheet-content">
                            {productoModal.prod.gruposOpciones?.map(grupo => {
                                const numSeleccionadas = opcionesElegidas[grupo.id]?.length || 0;
                                const esValido = numSeleccionadas >= (grupo.min_selecciones || 0) && numSeleccionadas <= (grupo.max_selecciones || 100);

                                return (
                                    <div key={grupo.id} className="vc-option-group">
                                        <h4 className="vc-group-title">
                                            {grupo.nombre}
                                            {grupo.min_selecciones > 0 ? (
                                                <span className={`vc-req-badge ${esValido ? 'valido' : 'pendiente'}`}>
                                                    {numSeleccionadas < grupo.min_selecciones
                                                        ? `Selecciona al menos ${grupo.min_selecciones}`
                                                        : `Mínimo cumplido (${numSeleccionadas})`}
                                                </span>
                                            ) : (
                                                <span className="vc-opt-badge">Opcional (máx {grupo.max_selecciones})</span>
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
                                                        <div className={grupo.max_selecciones === 1 ? "vc-radio-custom" : "vc-checkbox-custom"}>
                                                            {isSelected && (
                                                                grupo.max_selecciones === 1
                                                                    ? <div className="vc-radio-dot"></div>
                                                                    : <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check</span>
                                                            )}
                                                        </div>
                                                        <span className="vc-option-name">{opcion.nombre}</span>
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
                                <h4 className="vc-group-title">Notas adicionales</h4>
                                <textarea
                                    className="vc-textarea-notes"
                                    placeholder="Ej: Muy caliente, sin azúcar..."
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
                                    ? `Añadir al carrito • ${calcularPrecioFinalItem().toFixed(2)}€`
                                    : 'Completa las opciones requeridas'}
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
                                <p className="vc-voz-hint">Toca el micrófono cuando termines de hablar</p>
                                <button className="vc-btn-voz-close" onClick={cancelarVoz}>Cancelar</button>
                            </>
                        )}
                        {estadoVoz === 'procesando' && (
                            <>
                                <span className="material-symbols-outlined vc-icon-spin">autorenew</span>
                                <h2>{mensajeVoz}</h2>
                                <p className="vc-voz-hint">Analizando pedido con IA...</p>
                            </>
                        )}
                        {estadoVoz === 'exito' && (
                            <>
                                <span className="material-symbols-outlined vc-icon-success">check_circle</span>
                                <h2>Pedido realizado</h2>
                                <p className="vc-voz-hint">{mensajeVoz}</p>
                            </>
                        )}
                        {estadoVoz === 'error' && (
                            <>
                                <span className="material-symbols-outlined vc-icon-error">error</span>
                                <h2>Mmm... no lo tengo claro</h2>
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
                                width: '60px', height: '60px', backgroundColor: '#fff7ed', borderRadius: '50%', 
                                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px',
                                color: '#ec9213'
                            }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>payments</span>
                            </div>
                            <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#1e293b', marginBottom: '10px' }}>¿Cómo quieres pagar?</h3>
                            <p style={{ color: '#64748b', fontSize: '15px', lineHeight: '1.5', marginBottom: '25px' }}>
                                Puedes pagar el total de la cuenta pendiente o seleccionar productos específicos para dividir el pago.
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
                                        
                                        const esDigital = m.toLowerCase() === 'bizum' || m.toLowerCase().includes('google') || m.toLowerCase().includes('gpay');
                                        if (!esDigital) await ejecutarPagoMesa(indices, m);
                                        else await ejecutarPagoDigital(indices, m);
                                    }}
                                    style={{ 
                                        padding: '16px', borderRadius: '12px', border: 'none', 
                                        backgroundColor: '#ec9213', color: 'white', fontWeight: 'bold', 
                                        fontSize: '16px', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(236,146,19, 0.2)' 
                                    }}
                                >
                                    Pagar todo ({totalPendientePago.toFixed(2)}€)
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
                                    Seleccionar productos
                                </button>
                                
                                <button 
                                    onClick={() => setModalDivisionPago(null)}
                                    style={{ 
                                        marginTop: '10px', background: 'none', border: 'none', 
                                        color: '#94a3b8', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' 
                                    }}
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default VistaCliente;