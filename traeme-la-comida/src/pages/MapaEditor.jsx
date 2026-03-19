import React, { useState, useEffect } from 'react';
import './MapaEditor.css';
import { getSalasConMesas, guardarPlanoCompleto } from '../services/apiMap';

const MapaEditor = () => {
    const [salas, setSalas] = useState([{ id: Date.now(), nombre: 'Salón Principal', elementos: [], anchoSala: 800, altoSala: 500 }]);
    const [salaActivaId, setSalaActivaId] = useState(salas[0].id);
    const [arrastrando, setArrastrando] = useState(null);
    const [seleccionado, setSeleccionado] = useState(null);
    const [qrZoom, setQrZoom] = useState(null);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        const fetchDatos = async () => {
            const data = await getSalasConMesas();
            if (data && data.length > 0) {
                setSalas(data);
                setSalaActivaId(data[0].id);
            }
            setCargando(false);
        };
        fetchDatos();
    }, []);

    const salaActiva = salas.find(s => s.id === salaActivaId);

    const actualizarSalaConfig = (datos) => {
        setSalas(salas.map(s => s.id === salaActivaId ? { ...s, ...datos } : s));
    };

    const actualizarElemento = (id, nuevosDatos) => {
        actualizarSalaConfig({
            elementos: salaActiva.elementos.map(el => el.id === id ? { ...el, ...nuevosDatos } : el)
        });
    };

    const añadirElemento = (tipo) => {
        const maxActual = Math.max(...salaActiva.elementos.map(e => parseInt(e.numero) || 0), 0);
        let num = window.prompt(`Número de ${tipo}:`, maxActual + 1);

        if (!num) return;

        // Validar que no exista ya ese número en la sala (independientemente del tipo)
        while (salaActiva.elementos.some(e => String(e.numero) === String(num))) {
            num = window.prompt(`El número ${num} ya existe en esta sala. Por favor, elige otro:`, parseInt(num) + 1);
            if (!num) return;
        }

        const prefijo = tipo === 'barra' ? 'barra' : 'mesa';
        const anchoFijo = tipo === 'barra' ? 120 : 60;
        const altoFijo = tipo === 'barra' ? 40 : 60;

        const uniqueId = Math.random().toString(36).substring(2, 9);
        const nuevo = {
            id: Date.now(), // Cuando lo guardes en DB, la DB le asignará su ID real
            tipo: tipo, // Enum: 'mesa' o 'barra'
            numero: num,
            pos_x: 50, // Lo centramos por defecto (50%)
            pos_y: 50, // Lo centramos por defecto (50%)
            ancho: anchoFijo,
            alto: altoFijo,
            rotacion: 0,
            uid: uniqueId,
            link_qr: `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${prefijo}_${num}_${uniqueId}`
        };

        actualizarSalaConfig({ elementos: [...salaActiva.elementos, nuevo] });
        setSeleccionado(nuevo.id);
    };

    const obtenerPos = (e) => {
        const t = e.touches ? e.touches[0] : e;
        const rect = document.getElementById('cuadricula-canvas').getBoundingClientRect();
        return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    };

    const manejarMover = (e) => {
        if (!arrastrando) return;
        const pos = obtenerPos(e);

        // Calculamos la nueva posición en píxeles y la convertimos a porcentaje (0 a 100)
        let nuevoPosX = ((pos.x - arrastrando.offX) / salaActiva.anchoSala) * 100;
        let nuevoPosY = ((pos.y - arrastrando.offY) / salaActiva.altoSala) * 100;

        // Opcional: Limitar para que no se salgan del lienzo (0% a 100%)
        nuevoPosX = Math.max(0, Math.min(100, nuevoPosX));
        nuevoPosY = Math.max(0, Math.min(100, nuevoPosY));

        actualizarElemento(arrastrando.id, { pos_x: nuevoPosX, pos_y: nuevoPosY });
    };

    // Función que prepara exactamente el JSON que necesita tu base de datos
    const guardarPlano = async () => {
        const tieneDuplicadosTotal = salas.some(s => s.elementos.some(el => el.error_duplicado));
        if (tieneDuplicadosTotal) {
            alert("No puedes guardar el plano con números de mesa duplicados en alguna de las salas.");
            return;
        }

        try {
            await guardarPlanoCompleto(salas);
            alert("Plano guardado exitosamente en DB.");
        } catch (error) {
            console.error("Error guardando plano:", error);
            alert("Hubo un error guardando el plano.");
        }
    };

    const estiloCanvas = {
        width: `${salaActiva.anchoSala}px`,
        height: `${salaActiva.altoSala}px`,
        position: 'relative', // Importante para el Drag & Drop
        overflow: 'hidden'
    };

    const estiloElemento = (el, sel) => ({
        position: 'absolute',
        left: `${el.pos_x}%`, // Usamos porcentaje
        top: `${el.pos_y}%`,  // Usamos porcentaje
        width: `${el.ancho}px`,
        height: `${el.alto}px`,
        transform: `translate(-50%, -50%) rotate(${el.rotacion}deg)`, // Centrado y Rotación real
        backgroundColor: el.tipo === 'barra' ? '#f8fafc' : '#fff',
        border: sel ? '2px solid #ec9213' : '1px solid #cbd5e1',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'grab',
        zIndex: sel ? 10 : 1,
        transition: arrastrando ? 'none' : 'transform 0.2s' // Animación suave al rotar
    });

    if (cargando) return <div className="mapa-editor-main" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}><h3>Cargando Plano...</h3></div>;

    if (!salaActiva) return <div className="mapa-editor-main">Error crítico: no hay sala activa seleccionada.</div>;

    return (
        <div className="mapa-editor-main">
            <div className="mapa-editor-tabs no-scrollbar">
                {salas.map(sTab => (
                    <button
                        key={sTab.id}
                        className={`tab-btn ${salaActivaId === sTab.id ? 'active' : ''}`}
                        onClick={() => setSalaActivaId(sTab.id)}
                    >
                        {sTab.nombre}
                    </button>
                ))}
                <button
                    className="tab-btn-add"
                    onClick={() => { const n = window.prompt("Nombre de la sala:"); if (n) setSalas([...salas, { id: Date.now(), nombre: n, elementos: [], anchoSala: 800, altoSala: 500 }]) }}
                >
                    + Nueva Sala
                </button>
            </div>

            <div className="mapa-editor-toolbar">
                <div className="toolbar-group">
                    <button onClick={() => añadirElemento('mesa')} className="btnTool">🔲 Mesa</button>
                    <button onClick={() => añadirElemento('barra')} className="btnTool">➖ Barra</button>

                    {seleccionado && (
                        <div className="toolbar-actions">
                            <button onClick={() => {
                                const el = salaActiva.elementos.find(i => i.id === seleccionado);
                                // Incrementamos 90 grados y aplicamos módulo 360 para no acumular miles de grados
                                actualizarElemento(seleccionado, { rotacion: (el.rotacion + 90) % 360 });
                            }} className="btnTool btn-rotate">🔄 Rotar</button>

                            <button onClick={() => {
                                actualizarSalaConfig({ elementos: salaActiva.elementos.filter(i => i.id !== seleccionado) });
                                setSeleccionado(null);
                            }} className="btnTool btn-delete">🗑️ Borrar</button>
                        </div>
                    )}
                </div>

                <div className="toolbar-settings">
                    <button onClick={() => { const n = window.prompt("Nombre:", salaActiva.nombre); if (n) actualizarSalaConfig({ nombre: n }) }} className="btn-rename">✏️ Renombrar</button>
                    <span className="canvas-size">
                        Lienzo:
                        <input type="number" value={salaActiva.anchoSala} onChange={(e) => actualizarSalaConfig({ anchoSala: e.target.value })} /> x
                        <input type="number" value={salaActiva.altoSala} onChange={(e) => actualizarSalaConfig({ altoSala: e.target.value })} />
                    </span>
                    <button onClick={guardarPlano} className="btnTool btn-save">Guardar Plano</button>
                </div>
            </div>

            <div className="editor-layout">
                <div className="canvas-area">
                    <div
                        id="cuadricula-canvas"
                        className="grid-canvas"
                        style={estiloCanvas}
                        onMouseMove={manejarMover}
                        onTouchMove={manejarMover}
                        onMouseUp={() => setArrastrando(null)}
                        onTouchEnd={() => setArrastrando(null)}
                        onClick={(e) => e.target.id === 'cuadricula-canvas' && setSeleccionado(null)}
                    >
                        {salaActiva.elementos.map(el => (
                            <div
                                key={el.id}
                                style={estiloElemento(el, seleccionado === el.id)}
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    setSeleccionado(el.id);
                                    const pos = obtenerPos(e);
                                    // Calculamos el centro del elemento en píxeles basándonos en su porcentaje
                                    const elCentroX = (el.pos_x / 100) * salaActiva.anchoSala;
                                    const elCentroY = (el.pos_y / 100) * salaActiva.altoSala;
                                    setArrastrando({ id: el.id, offX: pos.x - elCentroX, offY: pos.y - elCentroY });
                                }}
                                onTouchStart={(e) => {
                                    e.stopPropagation();
                                    setSeleccionado(el.id);
                                    const pos = obtenerPos(e);
                                    const elCentroX = (el.pos_x / 100) * salaActiva.anchoSala;
                                    const elCentroY = (el.pos_y / 100) * salaActiva.altoSala;
                                    setArrastrando({ id: el.id, offX: pos.x - elCentroX, offY: pos.y - elCentroY });
                                }}
                            >
                                <span style={{ fontSize: '11px', fontWeight: 'bold', pointerEvents: 'none', transform: `rotate(-${el.rotacion}deg)` }}>
                                    {el.tipo === 'barra' ? 'B' : ''}{el.numero}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="editor-sidebar">
                    <h3>Inventario: {salaActiva.nombre}</h3>
                    <div className="inventory-list">
                        {salaActiva.elementos.map(el => (
                            <div key={el.id} className="inventory-item">
                                <img src={el.link_qr} onClick={() => setQrZoom(el)} alt="qr" />
                                <div className="inventory-details">
                                    <input
                                        type="text"
                                        value={el.numero}
                                        onChange={(e) => {
                                            const nuevoNum = e.target.value;
                                            const yaExiste = salaActiva.elementos.some(item => String(item.numero) === String(nuevoNum) && item.id !== el.id);

                                            const pref = el.tipo === 'barra' ? 'barra' : 'mesa';
                                            const currentUid = el.uid || Math.random().toString(36).substring(2, 9);

                                            actualizarElemento(el.id, {
                                                numero: nuevoNum,
                                                uid: currentUid,
                                                link_qr: `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${pref}_${nuevoNum}_${currentUid}`,
                                                error_duplicado: yaExiste // Opcional: para marcarlo visualmente
                                            });
                                        }}
                                        style={el.error_duplicado ? { border: '2px solid red' } : {}}
                                        title={el.error_duplicado ? "Este número ya existe en esta sala" : ""}
                                    />
                                    <span>{el.tipo.toUpperCase()}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {qrZoom && (
                <div className="qr-modal-overlay" onClick={() => setQrZoom(null)}>
                    <div className="qr-modal-content" onClick={e => e.stopPropagation()}>
                        <h2>{qrZoom.tipo === 'barra' ? 'Barra' : 'Mesa'} #{qrZoom.numero}</h2>
                        <img src={qrZoom.link_qr} alt="qr" />
                        <div className="qr-actions">
                            <a href={qrZoom.link_qr} download={`QR_${qrZoom.tipo}_${qrZoom.numero}.png`} className="btn-download">Descargar</a>
                            <button onClick={() => setQrZoom(null)} className="btn-close">Cerrar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MapaEditor;