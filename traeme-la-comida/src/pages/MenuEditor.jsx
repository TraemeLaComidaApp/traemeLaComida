import React, { useState, useRef, useEffect } from 'react';
import './MenuEditor.css';
import { getMenuCompletoAdmin, guardarMenuCompletoAdmin } from '../services/apiMenuManager';

export default function MenuEditor() {
    const fileInputRef = useRef(null);

    // ESTADOS PARA DRAG & DROP
    const [draggedCatIndex, setDraggedCatIndex] = useState(null);
    const [draggedProdInfo, setDraggedProdInfo] = useState(null); // Guarda { catId, prodIndex }

    const [categorias, setCategorias] = useState([]);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        const fetchMenu = async () => {
            const data = await getMenuCompletoAdmin();
            setCategorias(data || []);
            setCargando(false);
        };
        fetchMenu();
    }, []);

    const handleGuardarMenu = async () => {
        try {
            await guardarMenuCompletoAdmin(categorias);
            alert("Menú guardado exitosamente en la base de datos.");
        } catch (error) {
            console.error("Error al guardar menú:", error);
            alert("Hubo un error al intentar guardar el menú.");
        }
    };

    const [busqueda, setBusqueda] = useState('');
    const [editandoProd, setEditandoProd] = useState(null);
    const [editandoCategoria, setEditandoCategoria] = useState(null);

    // =========================================================
    // LÓGICA DE DRAG AND DROP (ARRASTRAR Y SOLTAR)
    // =========================================================

    // --- Arrastrar Categorías ---
    const handleCatDragStart = (index) => setDraggedCatIndex(index);
    const handleCatDragEnter = (e, index) => {
        if (draggedCatIndex === null || draggedCatIndex === index) return;
        const nuevasCategorias = [...categorias];
        const itemArrastrado = nuevasCategorias[draggedCatIndex];

        nuevasCategorias.splice(draggedCatIndex, 1);
        nuevasCategorias.splice(index, 0, itemArrastrado);

        // Reasignamos el orden
        nuevasCategorias.forEach((cat, i) => cat.orden = i);
        setCategorias(nuevasCategorias);
        setDraggedCatIndex(index);
    };
    const handleCatDragEnd = () => setDraggedCatIndex(null);

    // --- Arrastrar Productos ---
    const handleProdDragStart = (e, catId, prodIndex) => {
        e.stopPropagation(); // Evitar que la categoría capture el evento
        setDraggedProdInfo({ catId, prodIndex });
    };

    const handleProdDragEnter = (e, catId, targetIndex) => {
        e.stopPropagation();
        if (!draggedProdInfo || draggedProdInfo.catId !== catId || draggedProdInfo.prodIndex === targetIndex) return;

        const nuevasCategorias = [...categorias];
        const catIndex = nuevasCategorias.findIndex(c => c.id === catId);
        const nuevosProds = [...nuevasCategorias[catIndex].productos];

        const itemArrastrado = nuevosProds[draggedProdInfo.prodIndex];
        nuevosProds.splice(draggedProdInfo.prodIndex, 1);
        nuevosProds.splice(targetIndex, 0, itemArrastrado);

        // Reasignamos el orden
        nuevosProds.forEach((p, i) => p.orden = i);
        nuevasCategorias[catIndex].productos = nuevosProds;

        setCategorias(nuevasCategorias);
        setDraggedProdInfo({ catId, prodIndex: targetIndex });
    };
    const handleProdDragEnd = () => setDraggedProdInfo(null);

    // =========================================================
    // LÓGICA DE CATEGORÍAS Y SUS OPCIONES
    // =========================================================
    const abrirEditorCategoria = (categoria = null) => {
        if (categoria) {
            setEditandoCategoria({ ...categoria, gruposOpciones: categoria.gruposOpciones || [] });
        } else {
            setEditandoCategoria({ id: Date.now(), nombre: '', orden: categorias.length, gruposOpciones: [], productos: [] });
        }
    };

    const guardarCategoria = (e) => {
        e.preventDefault();
        if (!editandoCategoria.nombre.trim()) return alert("El nombre de la categoría es obligatorio.");

        const existe = categorias.find(c => c.id === editandoCategoria.id);
        if (existe) {
            setCategorias(categorias.map(cat => cat.id === editandoCategoria.id ? editandoCategoria : cat));
        } else {
            setCategorias([...categorias, editandoCategoria]);
        }
        setEditandoCategoria(null);
    };

    const eliminarCategoria = (id) => {
        if (window.confirm("¿Eliminar categoría y todos sus productos?")) {
            setCategorias(categorias.filter(c => c.id !== id));
        }
    };

    const agregarGrupoOpcionCat = () => {
        setEditandoCategoria({
            ...editandoCategoria,
            gruposOpciones: [...editandoCategoria.gruposOpciones, {
                id: Date.now(),
                nombre: '',
                obligatorio: false,
                opciones: [],
                orden: editandoCategoria.gruposOpciones.length // <--- AÑADIMOS EL ORDEN
            }]
        });
    };

    // Usamos una función general para actualizar campos del grupo (nombre, obligatorio, etc.)
    const actualizarCampoGrupoCat = (grupoId, campo, valor) => {
        setEditandoCategoria({
            ...editandoCategoria,
            gruposOpciones: editandoCategoria.gruposOpciones.map(g => g.id === grupoId ? { ...g, [campo]: valor } : g)
        });
    };

    const eliminarGrupoOpcionCat = (grupoId) => {
        setEditandoCategoria({
            ...editandoCategoria,
            gruposOpciones: editandoCategoria.gruposOpciones.filter(g => g.id !== grupoId)
        });
    };

    const agregarOpcionAGrupoCat = (grupoId) => {
        setEditandoCategoria({
            ...editandoCategoria,
            gruposOpciones: editandoCategoria.gruposOpciones.map(g => {
                if (g.id === grupoId) {
                    return {
                        ...g,
                        opciones: [...g.opciones, {
                            id: Date.now(),
                            nombre: '',
                            suplemento: 0,
                            orden: g.opciones.length // <--- AÑADIMOS EL ORDEN
                        }]
                    };
                }
                return g;
            })
        });
    };

    const actualizarOpcionCat = (grupoId, opcionId, campo, valor) => {
        setEditandoCategoria({
            ...editandoCategoria,
            gruposOpciones: editandoCategoria.gruposOpciones.map(g => {
                if (g.id === grupoId) {
                    return { ...g, opciones: g.opciones.map(o => o.id === opcionId ? { ...o, [campo]: valor } : o) };
                }
                return g;
            })
        });
    };

    const eliminarOpcionCat = (grupoId, opcionId) => {
        setEditandoCategoria({
            ...editandoCategoria,
            gruposOpciones: editandoCategoria.gruposOpciones.map(g => {
                if (g.id === grupoId) return { ...g, opciones: g.opciones.filter(o => o.id !== opcionId) };
                return g;
            })
        });
    };

    // =========================================================
    // LÓGICA DE PRODUCTOS
    // =========================================================
    const abrirEditorProducto = (catId, producto = null) => {
        const cat = categorias.find(c => c.id === catId);
        setEditandoProd(producto ? { ...producto, catId } : {
            id: null, catId, nombre: '', descripcion: '', precio: '', img: '', visible: true, orden: cat.productos.length
        });
    };

    const manejarImagen = (e) => {
        const archivo = e.target.files[0];
        if (archivo) {
            const reader = new FileReader();
            reader.onloadend = () => setEditandoProd({ ...editandoProd, img: reader.result });
            reader.readAsDataURL(archivo);
        }
    };

    const guardarProducto = (e) => {
        e.preventDefault();
        if (!editandoProd.nombre.trim() || !editandoProd.precio) return alert("Nombre y precio obligatorios.");

        setCategorias(categorias.map(cat => {
            if (cat.id === editandoProd.catId) {
                const existe = editandoProd.id ? cat.productos.find(p => p.id === editandoProd.id) : null;
                const nuevosProds = existe
                    ? cat.productos.map(p => p.id === editandoProd.id ? editandoProd : p)
                    : [...cat.productos, { ...editandoProd, id: Date.now() }];
                return { ...cat, productos: nuevosProds };
            }
            return cat;
        }));
        setEditandoProd(null);
    };

    const eliminarProducto = (catId, prodId) => {
        if (window.confirm("¿Eliminar este producto?")) {
            setCategorias(categorias.map(cat => cat.id === catId
                ? { ...cat, productos: cat.productos.filter(p => p.id !== prodId) } : cat));
            if (editandoProd?.id === prodId) setEditandoProd(null);
        }
    };

    const toggleVisibilidad = (catId, prodId) => {
        setCategorias(categorias.map(cat => cat.id === catId ? {
            ...cat, productos: cat.productos.map(p => p.id === prodId ? { ...p, visible: !p.visible } : p)
        } : cat));
    };

    if (cargando) {
        return <div className="menu-editor" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><h3>Cargando Menú...</h3></div>;
    }

    return (
        <div className="menu-editor">
            {/* Header y Buscador */}
            <div className="menu-header-actions">
                <div className="search-bar">
                    <span className="material-symbols-outlined">search</span>
                    <input type="text" placeholder="Buscar producto..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                </div>
                <button className="btn-save-all" onClick={handleGuardarMenu}>Guardar Menú Completo</button>
            </div>

            {/* Grid de Categorías ordenadas por el campo orden */}
            <div className="categories-grid">
                {categorias.sort((a, b) => a.orden - b.orden).map((cat, catIndex) => (
                    <section
                        key={cat.id}
                        className={`category-section ${draggedCatIndex === catIndex ? 'dragging' : ''}`}
                        draggable
                        onDragStart={() => handleCatDragStart(catIndex)}
                        onDragEnter={(e) => handleCatDragEnter(e, catIndex)}
                        onDragEnd={handleCatDragEnd}
                        onDragOver={(e) => e.preventDefault()}
                    >
                        <div className="category-header-wrapper">
                            <div className="category-header-main">
                                <div className="category-title-area">
                                    {/* Icono Drag */}
                                    <span className="material-symbols-outlined drag-handle" title="Arrastrar categoría">drag_indicator</span>
                                    <h3>{cat.nombre}</h3>
                                    <span className="count">{cat.productos.length} productos</span>
                                </div>
                                <div className="category-actions">
                                    <button className="btn-edit-category" onClick={() => abrirEditorCategoria(cat)}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>settings</span>
                                        Configurar Extras y Categoría
                                    </button>
                                    <button className="delete-cat-btn" onClick={() => eliminarCategoria(cat.id)} title="Eliminar Categoría">
                                        <span className="material-symbols-outlined">delete_sweep</span>
                                    </button>
                                </div>
                            </div>

                            {cat.gruposOpciones?.length > 0 && (
                                <div className="category-options-preview">
                                    <span className="options-label">
                                        <span className="material-symbols-outlined" style={{ fontSize: '14px', marginRight: '4px', verticalAlign: 'middle' }}>tune</span>
                                        Extras aplicados:
                                    </span>
                                    {cat.gruposOpciones.map(g => (
                                        <span key={g.id} className={`option-badge ${g.obligatorio ? 'obligatorio' : ''}`}>
                                            {g.nombre} {g.obligatorio && '*'}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="product-list">
                            {cat.productos
                                .sort((a, b) => a.orden - b.orden)
                                .filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase()))
                                .map((p, pIndex) => (
                                    <div
                                        key={p.id}
                                        className={`product-card ${!p.visible ? 'hidden' : ''} ${draggedProdInfo?.prodIndex === pIndex && draggedProdInfo?.catId === cat.id ? 'dragging' : ''}`}
                                        draggable
                                        onDragStart={(e) => handleProdDragStart(e, cat.id, pIndex)}
                                        onDragEnter={(e) => handleProdDragEnter(e, cat.id, pIndex)}
                                        onDragEnd={handleProdDragEnd}
                                        onDragOver={(e) => e.preventDefault()}
                                    >
                                        <div className="drag-handle-prod">
                                            <span className="material-symbols-outlined">drag_indicator</span>
                                        </div>
                                        <img src={p.img || 'https://via.placeholder.com/100'} alt="" className="product-img" />
                                        <div className="product-info">
                                            <h4>{p.nombre}</h4>
                                            <p className="price">{Number(p.precio).toFixed(2)}€</p>
                                            <div className="actions">
                                                <button className="icon-btn" onClick={() => abrirEditorProducto(cat.id, p)}>
                                                    <span className="material-symbols-outlined">edit</span>
                                                </button>
                                                <button className={`icon-btn ${p.visible ? 'active' : ''}`} onClick={() => toggleVisibilidad(cat.id, p.id)}>
                                                    <span className="material-symbols-outlined">{p.visible ? 'visibility' : 'visibility_off'}</span>
                                                </button>
                                                <button className="icon-btn delete" onClick={() => eliminarProducto(cat.id, p.id)}>
                                                    <span className="material-symbols-outlined">delete</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            <button className="add-product-btn" onClick={() => abrirEditorProducto(cat.id)}>
                                <span className="material-symbols-outlined">add</span>
                                Nuevo Producto
                            </button>
                        </div>
                    </section>
                ))}

                <button className="add-category-large" onClick={() => abrirEditorCategoria(null)}>
                    <span className="material-symbols-outlined">library_add</span>
                    Añadir Nueva Categoría
                </button>
            </div>

            {/* MODAL DE EDICIÓN DE CATEGORÍA Y OPCIONES */}
            {editandoCategoria && (
                <div className="modal-overlay">
                    <form className="product-modal" onSubmit={guardarCategoria}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0 }}>{editandoCategoria.productos ? 'Configurar' : 'Añadir'} Categoría</h3>
                            <button type="button" className="btn-close-modal" onClick={() => setEditandoCategoria(null)}>×</button>
                        </div>

                        <div className="input-group">
                            <label>Nombre de la Categoría *</label>
                            <input
                                type="text"
                                placeholder="Ej: CAFÉS, TOSTADAS..."
                                value={editandoCategoria.nombre}
                                onChange={e => setEditandoCategoria({ ...editandoCategoria, nombre: e.target.value.toUpperCase() })}
                            />
                        </div>

                        <div className="options-section">
                            <div className="options-header">
                                <h4>Opciones y Extras</h4>
                                <p>Estas opciones se aplicarán a <strong>todos</strong> los productos.</p>
                            </div>

                            {editandoCategoria.gruposOpciones.map(grupo => (
                                <div key={grupo.id} className="option-group-card">
                                    <div className="option-group-top">
                                        <input
                                            type="text"
                                            className="group-name-input"
                                            placeholder="Nombre del grupo (Ej: Tipo de Leche)"
                                            value={grupo.nombre}
                                            onChange={(e) => actualizarCampoGrupoCat(grupo.id, 'nombre', e.target.value)}
                                        />

                                        {/* NUEVO: CHECKBOX OBLIGATORIO */}
                                        <label className="checkbox-obligatorio">
                                            <input
                                                type="checkbox"
                                                checked={grupo.obligatorio || false}
                                                onChange={(e) => actualizarCampoGrupoCat(grupo.id, 'obligatorio', e.target.checked)}
                                            />
                                            Obligatorio
                                        </label>

                                        <button type="button" className="btn-delete-group" onClick={() => eliminarGrupoOpcionCat(grupo.id)} title="Eliminar este grupo">
                                            <span className="material-symbols-outlined">delete</span>
                                        </button>
                                    </div>

                                    <div className="option-items-list">
                                        {grupo.opciones.map(opcion => (
                                            <div key={opcion.id} className="option-item-row">
                                                <input
                                                    type="text"
                                                    placeholder="Ej: Avena"
                                                    value={opcion.nombre}
                                                    onChange={(e) => actualizarOpcionCat(grupo.id, opcion.id, 'nombre', e.target.value)}
                                                />
                                                <div className="suplemento-wrapper">
                                                    <span>+</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        placeholder="0.00"
                                                        value={opcion.suplemento}
                                                        onChange={(e) => actualizarOpcionCat(grupo.id, opcion.id, 'suplemento', e.target.value)}
                                                    />
                                                    <span>€</span>
                                                </div>
                                                <button type="button" className="btn-delete-option" onClick={() => eliminarOpcionCat(grupo.id, opcion.id)}>
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <button type="button" className="btn-add-option" onClick={() => agregarOpcionAGrupoCat(grupo.id)}>
                                        + Añadir opción
                                    </button>
                                </div>
                            ))}

                            <button type="button" className="btn-add-group" onClick={agregarGrupoOpcionCat}>
                                <span className="material-symbols-outlined">add_circle</span>
                                Nuevo Grupo de Extras
                            </button>
                        </div>

                        <div className="modal-footer">
                            <div style={{ display: 'flex', gap: '10px', width: '100%', justifyContent: 'flex-end', marginTop: '20px' }}>
                                <button type="button" onClick={() => setEditandoCategoria(null)} className="btn-cancel">Cancelar</button>
                                <button type="submit" className="btn-save">Guardar Categoría</button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {/* MODAL DE EDICIÓN DE PRODUCTO */}
            {editandoProd && (
                <div className="modal-overlay">
                    <form className="product-modal" onSubmit={guardarProducto}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0 }}>{editandoProd.id ? 'Editar' : 'Añadir'} Producto</h3>
                            <button type="button" className="btn-close-modal" onClick={() => setEditandoProd(null)}>×</button>
                        </div>
                        <div className="input-group">
                            <label>Nombre del Producto *</label>
                            <input type="text" value={editandoProd.nombre} onChange={e => setEditandoProd({ ...editandoProd, nombre: e.target.value })} />
                        </div>
                        <div className="input-group">
                            <label>Descripción</label>
                            <textarea value={editandoProd.descripcion} onChange={e => setEditandoProd({ ...editandoProd, descripcion: e.target.value })} />
                        </div>
                        <div className="row">
                            <div className="input-group">
                                <label>Precio Base (€) *</label>
                                <input type="number" step="0.01" value={editandoProd.precio} onChange={e => setEditandoProd({ ...editandoProd, precio: e.target.value })} />
                            </div>
                            <div className="input-group">
                                <label>Imagen</label>
                                <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={manejarImagen} />
                                <div className="image-upload-wrapper">
                                    <button type="button" className="btn-upload" onClick={() => fileInputRef.current.click()}>
                                        <span className="material-symbols-outlined">upload_file</span>
                                        {editandoProd.img ? 'Cambiar' : 'Subir'}
                                    </button>
                                    {editandoProd.img && (
                                        <div className="preview-mini">
                                            <img src={editandoProd.img} alt="" />
                                            <button type="button" onClick={() => setEditandoProd({ ...editandoProd, img: '' })}>×</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <div style={{ display: 'flex', gap: '10px', width: '100%', justifyContent: 'flex-end', marginTop: '20px' }}>
                                <button type="button" onClick={() => setEditandoProd(null)} className="btn-cancel">Cancelar</button>
                                <button type="submit" className="btn-save">Guardar Producto</button>
                            </div>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}