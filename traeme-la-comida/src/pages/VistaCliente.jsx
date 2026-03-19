import React, { useState, useEffect } from 'react';
import './VistaCliente.css';
import { getMenuCliente } from '../services/apiMenuManager';
import { submitOrder } from '../services/apiCliente';

const VistaCliente = () => {
    // --- 1. ESTADOS PRINCIPALES ---
    const [seccionActiva, setSeccionActiva] = useState('menu');
    const [filtroActivo, setFiltroActivo] = useState('Todo');
    const [carrito, setCarrito] = useState([]);
    const [camareroLlamado, setCamareroLlamado] = useState(false);
    const [metodoPagoMesa, setMetodoPagoMesa] = useState('cash');

    // --- ESTADOS DE LA BASE DE DATOS SIMULADA ---
    // En lugar de una constante fija, el menú es un estado que empieza vacío.
    const [menuData, setMenuData] = useState([]);
    const [cargandoMenu, setCargandoMenu] = useState(true);

    // Estados para el Modal del Producto
    const [productoModal, setProductoModal] = useState(null);
    const [opcionesElegidas, setOpcionesElegidas] = useState({});
    const [notaOpcional, setNotaOpcional] = useState("");

    // Estados para Modales de Pago
    const [modalPago, setModalPago] = useState(null); // 'bizum', 'gpay', 'mesa'
    const [tipoDivision, setTipoDivision] = useState('todo'); // 'todo' o 'seleccion'
    const [itemsSeleccionadosPago, setItemsSeleccionadosPago] = useState([]);

    // --- NUEVOS ESTADOS: ASISTENTE DE VOZ ---
    const [estadoVoz, setEstadoVoz] = useState(null);
    const [mensajeVoz, setMensajeVoz] = useState("");

    // --- 2. LLAMADA A LA BASE DE DATOS (FETCH) ---
    useEffect(() => {
        const fetchMenu = async () => {
            const dataMenu = await getMenuCliente();
            setMenuData(dataMenu || []);
            setCargandoMenu(false);
        };
        fetchMenu();
    }, []);

    const categoriasTabs = ['Todo', ...menuData.map(c => c.nombre)];

    // --- 3. FUNCIONES DE PRODUCTO Y CARRITO ---
    const abrirModalProducto = (prod, categoria) => {
        const seleccionesIniciales = {};
        categoria.gruposOpciones?.forEach(grupo => {
            // Inicializamos como array vacío para soportar múltiples selecciones
            seleccionesIniciales[grupo.id] = [];
            
            // Si es obligatorio y solo hay una opción posible, o si queremos mantener el comportamiento anterior de pre-seleccionar:
            // Pero según el requisito "obligue a seleccionar", mejor dejar que el usuario elija a menos que min_selecciones sea 1 y queramos facilitarlo.
            // Para ser estrictos con la obligatoriedad, empezamos vacío.
        });
        setOpcionesElegidas(seleccionesIniciales);
        setNotaOpcional("");
        setProductoModal({ prod, categoria });
    };

    const manejarSeleccionOpcion = (grupoId, opcion, max) => {
        const seleccionesActuales = opcionesElegidas[grupoId] || [];
        const yaSeleccionada = seleccionesActuales.find(o => o.id === opcion.id);

        if (max === 1) {
            // Comportamiento de Radio Button
            setOpcionesElegidas({ ...opcionesElegidas, [grupoId]: [opcion] });
        } else {
            // Comportamiento de Checkbox
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
                    alert(`Solo puedes seleccionar un máximo de ${max} opciones para este grupo.`);
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
        return productoModal.categoria.gruposOpciones?.every(grupo => {
            const numSeleccionadas = opcionesElegidas[grupo.id]?.length || 0;
            return numSeleccionadas >= (grupo.min_selecciones || 0) && numSeleccionadas <= (grupo.max_selecciones || 100);
        });
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
            nombre: productoModal.prod.nombre, // guardamos también en root para pintar facil
            precioFinal,
            extrasAplicados: resumenOpciones,
            notaPersonal: notaOpcional,
            nota: notaOpcional, // guardamos también en root para pintar facil
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
        
        try {
            // Asumimos mesaId = 1 por defecto (al ser una demo)
            await submitOrder(1, false, null, itemsPorEnviar);
            
            const carritoEnviado = carrito.map(item => ({ ...item, enviado: true }));
            setCarrito(carritoEnviado);
            alert("¡Pedido enviado a cocina!");
        } catch (error) {
            console.error("Error al enviar pedido:", error);
            alert("Hubo un error enviando tu pedido a cocina.");
        }
    };

    const llamarAlCamarero = () => {
        if (!camareroLlamado && window.confirm("¿Deseas llamar al camarero?")) {
            setCamareroLlamado(true);
        }
    };

    // --- 4. LÓGICA DE PAGO POR PRODUCTO ---
    const iniciarPago = (metodo) => {
        const indicesPagables = carrito
            .map((item, index) => ({ item, index }))
            .filter(({ item }) => item.enviado && !item.estadoPago)
            .map(({ index }) => index);

        if (indicesPagables.length === 0) {
            if (carrito.some(item => !item.enviado)) {
                alert("Primero debes enviar los artículos a cocina para poder pagarlos.");
            } else {
                alert("No hay artículos pendientes de pago.");
            }
            return;
        }

        if (carrito.some(item => !item.enviado && !item.estadoPago)) {
            const confirmar = window.confirm("Tienes artículos sin enviar a cocina. Solo se cobrarán los que ya están en cocina. ¿Deseas continuar?");
            if (!confirmar) return;
        }

        setItemsSeleccionadosPago(indicesPagables);
        setTipoDivision('todo');
        setModalPago(metodo);
    };

    const toggleSeleccionPago = (index) => {
        if (itemsSeleccionadosPago.includes(index)) {
            setItemsSeleccionadosPago(itemsSeleccionadosPago.filter(i => i !== index));
        } else {
            setItemsSeleccionadosPago([...itemsSeleccionadosPago, index]);
        }
    };

    const confirmarPagoFinal = () => {
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
        setModalPago(null);
        setItemsSeleccionadosPago([]);
    };

    const simularCobroCamarero = () => {
        const nuevoCarrito = carrito.map(item => {
            if (item.estadoPago === 'solicitado_mesa') {
                return { ...item, estadoPago: 'pagado' };
            }
            return item;
        });
        setCarrito(nuevoCarrito);
    };

    // --- 5. LÓGICA: SIMULACIÓN DE ASISTENTE DE VOZ ---
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

                // Buscamos un producto real del menú para simular el éxito
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

    // --- CÁLCULOS DE TOTALES ---
    const totalPrecioCarrito = carrito.reduce((acc, item) => acc + item.precioFinal, 0);
    const totalPendientePago = carrito.filter(item => !item.estadoPago).reduce((acc, item) => acc + item.precioFinal, 0);
    const totalEsperandoMesa = carrito.filter(item => item.estadoPago === 'solicitado_mesa').reduce((acc, item) => acc + item.precioFinal, 0);
    const totalPagoSeleccionado = itemsSeleccionadosPago.reduce((acc, i) => acc + carrito[i].precioFinal, 0);
    const todosPagados = carrito.length > 0 && carrito.every(item => item.estadoPago === 'pagado');

    // --- PANTALLA DE CARGA (Mientras espera a la base de datos) ---
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

            <div className={`vista-cliente-container ${(productoModal || modalPago || estadoVoz) ? 'no-scroll' : ''}`}>
                <header className="vc-header">
                    <div className="vc-header-icon">
                        <span className="material-symbols-outlined">coffee</span>
                    </div>
                    <h2>Morning Break</h2>
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
                                                    <div>
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
                                                    {!item.enviado && !item.estadoPago && (
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
                                    </div>
                                </div>

                                {/* TARJETA ESPERANDO AL CAMARERO */}
                                {totalEsperandoMesa > 0 && (
                                    <div className="vc-pago-card" style={{ borderColor: '#bfdbfe', backgroundColor: '#eff6ff', marginTop: '30px', textAlign: 'center' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#3b82f6', fontSize: '48px', marginBottom: '10px' }}>hourglass_top</span>
                                        <h3 style={{ color: '#1e293b', marginBottom: '5px' }}>Camarero en camino</h3>
                                        <p style={{ color: '#64748b', margin: '0', fontSize: '14px' }}>
                                            Prepara <strong>{totalEsperandoMesa.toFixed(2)}€</strong> para abonar en la mesa.
                                        </p>
                                        <button
                                            onClick={simularCobroCamarero}
                                            style={{ marginTop: '20px', background: 'none', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '8px 15px', color: '#3b82f6', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}
                                        >
                                            (Botón Test: Simular cobro del camarero)
                                        </button>
                                    </div>
                                )}

                                {/* BLOQUE PAGOS (Solo si hay pendientes) */}
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

            {/* =========================================================
                MODAL DE PRODUCTO (BOTTOM SHEET)
            ========================================================= */}
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
                            {productoModal.categoria.gruposOpciones?.map(grupo => {
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
                                                <span className="vc-opt-badge">Opcional (máx ${grupo.max_selecciones})</span>
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
                                                                    : <span className="material-symbols-outlined" style={{fontSize: '16px'}}>check</span>
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

            {/* =========================================================
                MODAL DE PAGO (BOTTOM SHEET)
            ========================================================= */}
            {modalPago && (
                <>
                    <div className="vc-modal-backdrop" onClick={() => setModalPago(null)}></div>
                    <div className="vc-product-sheet">
                        <button className="vc-sheet-close" onClick={() => setModalPago(null)}>
                            <span className="material-symbols-outlined">close</span>
                        </button>

                        <div className="vc-sheet-header" style={{ borderBottom: 'none', paddingBottom: '0' }}>
                            <div className="vc-sheet-title" style={{ width: '100%' }}>
                                <h3>¿Cómo quieres pagar?</h3>
                                <p>Selecciona si pagas todo lo pendiente o solo una parte.</p>
                            </div>
                        </div>

                        <div className="vc-sheet-content" style={{ paddingTop: '15px' }}>
                            <div className="vc-radio-group">
                                <div
                                    className={`vc-radio-box ${tipoDivision === 'todo' ? 'active' : ''}`}
                                    onClick={() => {
                                        setTipoDivision('todo');
                                        const indicesPagables = carrito
                                            .map((item, index) => ({ item, index }))
                                            .filter(({ item }) => item.enviado && !item.estadoPago)
                                            .map(({ index }) => index);
                                        setItemsSeleccionadosPago(indicesPagables);
                                    }}
                                >
                                    <span className="material-symbols-outlined">receipt_long</span>
                                    <span>Pagar Pendiente</span>
                                </div>
                                <div
                                    className={`vc-radio-box ${tipoDivision === 'seleccion' ? 'active' : ''}`}
                                    onClick={() => setTipoDivision('seleccion')}
                                >
                                    <span className="material-symbols-outlined">checklist</span>
                                    <span>Elegir Artículos</span>
                                </div>
                            </div>

                            {tipoDivision === 'seleccion' && (
                                <div className="vc-options-list" style={{ marginTop: '20px' }}>
                                    <h4 className="vc-group-title" style={{ marginBottom: '10px' }}>Marca tus productos:</h4>
                                    {carrito.map((item, i) => {
                                        if (!item.enviado || item.estadoPago) return null;
                                        const isSelected = itemsSeleccionadosPago.includes(i);
                                        return (
                                            <div
                                                key={i}
                                                className={`vc-option-row ${isSelected ? 'selected' : ''}`}
                                                onClick={() => toggleSeleccionPago(i)}
                                            >
                                                <div className="vc-checkbox-custom">
                                                    {isSelected && <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#ec9213', fontWeight: 'bold' }}>check</span>}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <span className="vc-option-name" style={{ display: 'block' }}>{item.nombre}</span>
                                                    {item.opcionesAplicadas?.map((opt, idx) => (
                                                        <span key={idx} style={{ fontSize: '11px', color: '#64748b', marginRight: '5px' }}>
                                                            {opt.nombre}
                                                        </span>
                                                    ))}
                                                </div>
                                                <span className="vc-option-sup">{item.precioFinal.toFixed(2)}€</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="vc-sheet-footer">
                            <button
                                className="vc-btn-carrito btn-dark"
                                onClick={confirmarPagoFinal}
                                disabled={itemsSeleccionadosPago.length === 0}
                                style={{ opacity: itemsSeleccionadosPago.length === 0 ? 0.5 : 1 }}
                            >
                                Confirmar Pago • {totalPagoSeleccionado.toFixed(2)}€
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* =========================================================
                NUEVO MODAL ASISTENTE DE VOZ (PANTALLA COMPLETA)
            ========================================================= */}
            {estadoVoz && (
                <div className="vc-voz-overlay">
                    <div className="vc-voz-content">

                        {/* ESTADO 1: ESCUCHANDO */}
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

                        {/* ESTADO 2: PROCESANDO */}
                        {estadoVoz === 'procesando' && (
                            <>
                                <span className="material-symbols-outlined vc-icon-spin">autorenew</span>
                                <h2>{mensajeVoz}</h2>
                                <p className="vc-voz-hint">Analizando pedido con IA...</p>
                            </>
                        )}

                        {/* ESTADO 3: ÉXITO */}
                        {estadoVoz === 'exito' && (
                            <>
                                <span className="material-symbols-outlined vc-icon-success">check_circle</span>
                                <h2>Pedido realizado</h2>
                                <p className="vc-voz-hint">{mensajeVoz}</p>
                            </>
                        )}

                        {/* ESTADO 4: ERROR */}
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
        </div>
    );
};

export default VistaCliente;