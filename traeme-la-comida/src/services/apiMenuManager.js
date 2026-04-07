import { fetchApi } from './apiClient';

const isNewItem = (id) => !id || (typeof id === 'number' && id > 1000000000000);

export const getMenuCompletoAdmin = async () => {
    try {
        const [categoriasData, productosData, catOpcionesData, opcionesData, prodCatOpciones] = await Promise.all([
            fetchApi('/categoria-producto'),
            fetchApi('/producto'),
            fetchApi('/categoria-opcion'),
            fetchApi('/opcion'),
            fetchApi('/producto-categoria-opcion')
        ]);

        const categorias = (categoriasData || []).sort((a, b) => a.orden - b.orden);
        const productos = (productosData || []).sort((a, b) => a.orden - b.orden);
        const gruposOpciones = catOpcionesData || [];
        const opciones = opcionesData || [];
        const rels = prodCatOpciones || [];

        return categorias.map(cat => {
            const prods = productos.filter(p => p.id_categoria_producto === cat.id);

            return {
                id: cat.id,
                nombre: cat.nombre,
                orden: cat.orden,
                productos: prods.map(p => {
                    const prodRels = rels.filter(rel => rel.id_producto == p.id);

                    const gruposOpcionesFormated = prodRels.map(rel => {
                        const catOpcion = gruposOpciones.find(co => co.id == rel.id_categoria_opcion);
                        if (!catOpcion) return null;

                        const opcionesDelGrupo = opciones.filter(op => op.id_categoria_opcion == catOpcion.id);

                        return {
                            id: catOpcion.id,
                            nombre: catOpcion.nombre,
                            min_selecciones: rel.min_selecciones,
                            max_selecciones: rel.max_selecciones,
                            orden: rel.orden,
                            opciones: opcionesDelGrupo.map(op => ({
                                id: op.id,
                                nombre: op.nombre,
                                suplemento: Number(op.precio_extra) || 0
                            }))
                        };
                    }).filter(Boolean);

                    // NORMALIZACIÓN: Devolvemos nombres SQL y nombres Frontend
                    return {
                        id: p.id,
                        id_categoria_producto: p.id_categoria_producto,
                        nombre: p.nombre,
                        // Compatibilidad de descripción
                        descripcion: p.descripcion,
                        desc: p.descripcion,
                        precio: p.precio,
                        // Compatibilidad de imagen
                        imagen_url: p.imagen_url,
                        img: p.imagen_url,
                        // Compatibilidad de visibilidad
                        disponible: p.disponible,
                        visible: p.disponible,
                        orden: p.orden,
                        gruposOpciones: gruposOpcionesFormated
                    };
                })
            };
        });
    } catch (error) {
        console.error("Error fetching menu:", error);
        return [];
    }
};

export const getMenuCliente = async () => {
    const fullMenu = await getMenuCompletoAdmin();
    return fullMenu.map(cat => ({
        ...cat,
        productos: cat.productos.filter(p => p.disponible)
    })).filter(cat => cat.productos.length > 0);
};

export const guardarMenuCompletoAdmin = async (categoriasConfig) => {
    // 1. OBTENER ESTADO ACTUAL PARA DIFFING
    const [dbCategorias, dbProductos, dbCatOpciones, dbOpciones] = await Promise.all([
        fetchApi('/categoria-producto') || [],
        fetchApi('/producto') || [],
        fetchApi('/categoria-opcion') || [],
        fetchApi('/opcion') || []
    ]);

    const idsCatNuevas = new Set(categoriasConfig.filter(c => !isNewItem(c.id)).map(c => Number(c.id)));
    const idsProdNuevos = new Set();
    const idsOpcionesNuevas = new Set();

    categoriasConfig.forEach(c => {
        c.productos.forEach(p => {
            if (!isNewItem(p.id)) idsProdNuevos.add(Number(p.id));
            if (p.gruposOpciones) {
                p.gruposOpciones.forEach(g => {
                    g.opciones.forEach(o => {
                        if (!isNewItem(o.id)) idsOpcionesNuevas.add(Number(o.id));
                    });
                });
            }
        });
    });

    // 2. BORRADOS FÍSICOS (Items que estaban en DB pero ya no están en el config)
    // Borrar Productos primero
    for (const p of dbProductos) {
        if (!idsProdNuevos.has(Number(p.id))) {
            await fetchApi(`/producto/${p.id}`, { method: 'DELETE' }).catch(() => {});
        }
    }
    // Borrar Categorías
    for (const c of dbCategorias) {
        if (!idsCatNuevas.has(Number(c.id))) {
            await fetchApi(`/categoria-producto/${c.id}`, { method: 'DELETE' }).catch(() => {});
        }
    }

    // 3. PROCESAR GUARDADO (UPSERT)
    const translationQueue = new Set(); // Usar Set para evitar duplicados en la cola

    for (const cat of categoriasConfig) {
        let catId = cat.id;

        if (isNewItem(cat.id)) {
            const data = await fetchApi('/categoria-producto', {
                method: 'POST',
                body: JSON.stringify({ nombre: String(cat.nombre), orden: Number(cat.orden) })
            });
            catId = data?.id || data?.data?.id || (Array.isArray(data) && data[0]?.id);
            if (catId) translationQueue.add(cat.nombre);
        } else {
            await fetchApi(`/categoria-producto/${cat.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ nombre: String(cat.nombre), orden: Number(cat.orden) })
            });
        }

        if (!catId) continue;

        for (const prod of cat.productos) {
            let prodId = prod.id;
            const isNewProd = isNewItem(prod.id);

            if (prod.imagen_url instanceof File || prod.img instanceof File) {
                const file = (prod.imagen_url instanceof File) ? prod.imagen_url : prod.img;
                const formData = new FormData();
                formData.append('nombre', String(prod.nombre));
                formData.append('descripcion', prod.descripcion || prod.desc || '');
                formData.append('precio', String(prod.precio));
                formData.append('id_categoria_producto', String(catId));
                formData.append('disponible', String(Boolean(prod.disponible || prod.visible)));
                formData.append('orden', String(Number(prod.orden)));
                formData.append('imagen', file);

                const endpoint = isNewProd ? '/producto/upload' : `/producto/upload/${prod.id}`;
                const data = await fetchApi(endpoint, {
                    method: isNewProd ? 'POST' : 'PATCH',
                    body: formData
                });
                prodId = data?.id || data?.data?.id || (Array.isArray(data) && data[0]?.id);
            } else {
                const prodPayload = {
                    id_categoria_producto: Number(catId),
                    nombre: String(prod.nombre),
                    descripcion: prod.descripcion || prod.desc || '',
                    precio: Number(prod.precio),
                    imagen_url: prod.imagen_url || prod.img || '',
                    disponible: Boolean(prod.disponible || prod.visible),
                    orden: Number(prod.orden)
                };

                if (isNewProd) {
                    const data = await fetchApi('/producto', { method: 'POST', body: JSON.stringify(prodPayload) });
                    prodId = data?.id || data?.data?.id || (Array.isArray(data) && data[0]?.id);
                } else {
                    await fetchApi(`/producto/${prod.id}`, { method: 'PATCH', body: JSON.stringify(prodPayload) });
                }
            }

            if (!prodId) continue;
            
            // Queue translation
            if (isNewProd) {
                translationQueue.add(prod.nombre);
                if (prod.descripcion || prod.desc) translationQueue.add(prod.descripcion || prod.desc);
            }

            // Limpiar relaciones de opciones
            try {
                const currentRels = await fetchApi(`/producto-categoria-opcion/producto/${prodId}`);
                if (Array.isArray(currentRels)) {
                    for (const rel of currentRels) {
                        await fetchApi(`/producto-categoria-opcion/${prodId}/${rel.id_categoria_opcion}`, { method: 'DELETE' });
                    }
                }
            } catch (errClean) { }

            const gruposListos = [];
            if (prod.gruposOpciones && prod.gruposOpciones.length > 0) {
                for (const grupo of prod.gruposOpciones) {
                    let grupoId = grupo.id;
                    if (isNewItem(grupo.id)) {
                        const existente = dbCatOpciones.find(g => g.nombre.toLowerCase() === grupo.nombre.toLowerCase());
                        if (existente) grupoId = existente.id;
                        else {
                            const data = await fetchApi('/categoria-opcion', { method: 'POST', body: JSON.stringify({ nombre: String(grupo.nombre) }) });
                            grupoId = data?.id || data?.data?.id || (Array.isArray(data) && data[0]?.id);
                            if (grupoId) {
                                dbCatOpciones.push({ id: grupoId, nombre: grupo.nombre });
                                translationQueue.add(grupo.nombre);
                            }
                        }
                    } else {
                        await fetchApi(`/categoria-opcion/${grupo.id}`, { method: 'PATCH', body: JSON.stringify({ nombre: String(grupo.nombre) }) });
                    }

                    if (!grupoId) continue;

                    for (const op of grupo.opciones) {
                        const opPayload = { id_categoria_opcion: Number(grupoId), nombre: String(op.nombre), precio_extra: Number(op.suplemento) || 0 };
                        if (isNewItem(op.id)) {
                            const opExistente = dbOpciones.find(o => o.id_categoria_opcion == grupoId && o.nombre.toLowerCase() === op.nombre.toLowerCase());
                            if (opExistente) {
                                idsOpcionesNuevas.add(Number(opExistente.id));
                            } else {
                                const data = await fetchApi('/opcion', { method: 'POST', body: JSON.stringify(opPayload) });
                                const newId = data?.id || (Array.isArray(data) && data[0]?.id);
                                if (newId) {
                                    dbOpciones.push({ ...opPayload, id: newId });
                                    idsOpcionesNuevas.add(Number(newId));
                                    translationQueue.add(op.nombre);
                                }
                            }
                        } else {
                            idsOpcionesNuevas.add(Number(op.id));
                            await fetchApi(`/opcion/${op.id}`, { method: 'PATCH', body: JSON.stringify(opPayload) });
                        }
                    }
                    gruposListos.push({ id: grupoId, min: grupo.min_selecciones, max: grupo.max_selecciones });
                }
            }

            for (const [idx, g] of gruposListos.entries()) {
                await fetchApi('/producto-categoria-opcion', {
                    method: 'POST',
                    body: JSON.stringify({ id_producto: Number(prodId), id_categoria_opcion: Number(g.id), min_selecciones: Number(g.min), max_selecciones: Number(g.max), orden: idx })
                });
            }
        }
    }

    // 4. TRADUCCIONES EN BATCH (Al final para evitar recargas prematuras de Vite)
    if (translationQueue.size > 0) {
        const items = Array.from(translationQueue).map(text => ({ text, key: text }));
        await fetchApi('/voice/translate-batch', {
            method: 'POST',
            body: JSON.stringify({ items })
        }).catch(err => console.error("Error en batch translation:", err));
    }

    // 4. LIMPIEZA FINAL DE OPCIONES HUÉRFANAS
    for (const op of dbOpciones) {
        if (!idsOpcionesNuevas.has(Number(op.id))) {
            await fetchApi(`/opcion/${op.id}`, { method: 'DELETE' }).catch(() => {});
        }
    }
};