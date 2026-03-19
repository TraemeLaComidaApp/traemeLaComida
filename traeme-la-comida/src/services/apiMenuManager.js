import { fetchApi } from './apiClient';

// Función auxiliar para detectar IDs temporales creados por React (Date.now())
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
                // Mapeamos los productos de esta categoría
                productos: prods.map(p => {
                    // Buscamos qué grupos de opciones tiene enlazados ESTE producto
                    const prodRels = rels.filter(rel => rel.id_producto == p.id);

                    const gruposOpcionesFormated = prodRels.map(rel => {
                        const catOpcion = gruposOpciones.find(co => co.id == rel.id_categoria_opcion);
                        if (!catOpcion) return null;

                        const opcionesDelGrupo = opciones.filter(op => op.id_categoria_opcion == catOpcion.id);

                        return {
                            id: catOpcion.id,
                            nombre: catOpcion.nombre,
                            // Extraemos min y max de la tabla puente (producto-categoria-opcion)
                            min_selecciones: rel.min_selecciones,
                            max_selecciones: rel.max_selecciones,
                            orden: rel.orden, // Mantenemos el orden
                            opciones: opcionesDelGrupo.map(op => ({
                                id: op.id,
                                nombre: op.nombre,
                                suplemento: Number(op.precio_extra) || 0
                            }))
                        };
                    }).filter(Boolean);

                    return {
                        id: p.id,
                        catId: cat.id,
                        nombre: p.nombre,
                        desc: p.descripcion,
                        precio: p.precio,
                        img: p.imagen_url,
                        visible: p.disponible,
                        orden: p.orden,
                        gruposOpciones: gruposOpcionesFormated // Añadimos las opciones al producto
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
        productos: cat.productos.filter(p => p.visible)
    })).filter(cat => cat.productos.length > 0);
};

export const guardarMenuCompletoAdmin = async (categoriasConfig) => {
    // Nos traemos los datos actuales para comparar y evitar duplicados de nombre
    const dbCatOpciones = await fetchApi('/categoria-opcion') || [];
    const dbOpciones = await fetchApi('/opcion') || [];

    for (const cat of categoriasConfig) {
        let catId = cat.id;

        // 1. GUARDAR CATEGORÍA
        if (isNewItem(cat.id)) {
            const data = await fetchApi('/categoria-producto', {
                method: 'POST',
                body: JSON.stringify({ nombre: String(cat.nombre), orden: Number(cat.orden) })
            });
            catId = data?.id || data?.data?.id || (Array.isArray(data) && data[0]?.id);
        } else {
            await fetchApi(`/categoria-producto/${cat.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ nombre: String(cat.nombre), orden: Number(cat.orden) })
            });
        }

        if (!catId) continue;

        // 2. GUARDAR PRODUCTOS (Bucle que cuelga de la categoría)
        for (const prod of cat.productos) {
            let prodId = prod.id;
            const prodPayload = {
                id_categoria_producto: Number(catId),
                nombre: String(prod.nombre),
                descripcion: prod.desc ? String(prod.desc) : '',
                precio: Number(prod.precio),
                imagen_url: prod.img ? String(prod.img) : '',
                disponible: Boolean(prod.visible),
                orden: Number(prod.orden)
            };

            if (isNewItem(prod.id)) {
                const data = await fetchApi('/producto', { method: 'POST', body: JSON.stringify(prodPayload) });
                prodId = data?.id || data?.data?.id || (Array.isArray(data) && data[0]?.id);
            } else {
                await fetchApi(`/producto/${prod.id}`, { method: 'PATCH', body: JSON.stringify(prodPayload) });
            }

            if (!prodId) continue;

            // 3. LIMPIAR RELACIONES ANTIGUAS Y GUARDAR NUEVAS (producto-categoria-opcion)
            // Primero eliminamos todas las relaciones existentes para este producto para evitar conflictos
            try {
                // El backend debería soportar DELETE /producto-categoria-opcion/producto/:id
                // Si no, tendremos que borrar una a una o el backend debe tener un endpoint de limpieza
                // Según el controlador tenemos DELETE :idProducto/:idCategoriaOpcion
                // Vamos a intentar obtener las actuales y borrarlas
                const currentRels = await fetchApi(`/producto-categoria-opcion/producto/${prodId}`);
                if (Array.isArray(currentRels)) {
                    for (const rel of currentRels) {
                        await fetchApi(`/producto-categoria-opcion/${prodId}/${rel.id_categoria_opcion}`, { method: 'DELETE' });
                    }
                }
            } catch (errClean) {
                console.warn("No se pudieron limpiar las relaciones antiguas (puede que no existieran):", errClean);
            }

            // 4. GUARDAR GRUPOS DE OPCIONES (Bucle que cuelga DEL PRODUCTO)
            const gruposListosParaEsteProducto = [];

            if (prod.gruposOpciones && prod.gruposOpciones.length > 0) {
                for (const grupo of prod.gruposOpciones) {
                    let grupoId = grupo.id;

                    // A) Guardar el "Grupo" (Ej: Tipo de Leche)
                    if (isNewItem(grupo.id)) {
                        // Buscamos si ya existe uno con el mismo nombre en la DB global
                        const existente = dbCatOpciones.find(g => g.nombre.toLowerCase() === grupo.nombre.toLowerCase());

                        if (existente) {
                            grupoId = existente.id;
                        } else {
                            const data = await fetchApi('/categoria-opcion', {
                                method: 'POST',
                                body: JSON.stringify({ nombre: String(grupo.nombre) })
                            });
                            grupoId = data?.id || data?.data?.id || (Array.isArray(data) && data[0]?.id);
                            // Actualizamos dbCatOpciones para que el siguiente producto lo encuentre
                            if (grupoId) dbCatOpciones.push({ id: grupoId, nombre: grupo.nombre });
                        }
                    } else {
                        await fetchApi(`/categoria-opcion/${grupo.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ nombre: String(grupo.nombre) })
                        });
                    }

                    if (!grupoId) continue;

                    // B) Guardar las "Opciones" de ese grupo (Ej: Avena, Soja)
                    for (const op of grupo.opciones) {
                        let opId = op.id;
                        const opPayload = {
                            id_categoria_opcion: Number(grupoId),
                            nombre: String(op.nombre),
                            precio_extra: Number(op.suplemento) || 0.00
                        };

                        if (isNewItem(op.id)) {
                            const existente = dbOpciones.find(o => 
                                o.nombre.toLowerCase() === op.nombre.toLowerCase() && 
                                o.id_categoria_opcion == grupoId
                            );

                            if (existente) {
                                opId = existente.id;
                                await fetchApi(`/opcion/${opId}`, { method: 'PATCH', body: JSON.stringify(opPayload) });
                            } else {
                                const data = await fetchApi('/opcion', { method: 'POST', body: JSON.stringify(opPayload) });
                                opId = data?.id || data?.data?.id || (Array.isArray(data) && data[0]?.id);
                                if (opId) dbOpciones.push({ ...opPayload, id: opId });
                            }
                        } else {
                            await fetchApi(`/opcion/${op.id}`, { method: 'PATCH', body: JSON.stringify(opPayload) });
                        }
                    }

                    // Guardamos la info del grupo para crear la relación con este producto
                    gruposListosParaEsteProducto.push({
                        id: grupoId,
                        min_selecciones: grupo.min_selecciones,
                        max_selecciones: grupo.max_selecciones
                    });
                }
            }

            // 5. CREAR LAS RELACIONES EN LA TABLA PUENTE (producto-categoria-opcion)
            for (const [gListoIndex, gListo] of gruposListosParaEsteProducto.entries()) {
                const relPayload = {
                    id_producto: Number(prodId),
                    id_categoria_opcion: Number(gListo.id),
                    min_selecciones: Number(gListo.min_selecciones),
                    max_selecciones: Number(gListo.max_selecciones),
                    orden: gListoIndex
                };

                try {
                    await fetchApi('/producto-categoria-opcion', {
                        method: 'POST',
                        body: JSON.stringify(relPayload)
                    });
                } catch (errRel) {
                    console.error("Error vinculando producto con opción:", errRel);
                }
            }
        }
    }
};

// Se mantiene igual, es para la vista del camarero
export const getProductosDisponibles = async () => {
    try {
        const data = await fetchApi('/producto') || [];
        return data.filter(p => p.disponible).sort((a, b) => a.orden - b.orden);
    } catch (error) {
        console.error('Error fetching productos:', error);
        return [];
    }
};