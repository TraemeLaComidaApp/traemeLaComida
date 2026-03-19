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

            let gruposOpcionesFormated = [];
            // Extraemos los extras del primer producto de la categoría (ya que se aplican a todos)
            if (prods.length > 0) {
                const prodRels = rels.filter(rel => rel.id_producto === prods[0].id);
                gruposOpcionesFormated = prodRels.map(rel => {
                    const catOpcion = gruposOpciones.find(co => co.id === rel.id_categoria_opcion);
                    if (!catOpcion) return null;
                    const opcionesDelGrupo = opciones.filter(op => op.id_categoria_opcion === catOpcion.id);

                    return {
                        id: catOpcion.id,
                        nombre: catOpcion.nombre,
                        obligatorio: rel.min_selecciones > 0,
                        min_selecciones: rel.min_selecciones,
                        max_selecciones: rel.max_selecciones,
                        opciones: opcionesDelGrupo.map(op => ({
                            id: op.id,
                            nombre: op.nombre,
                            suplemento: Number(op.precio_extra) || 0
                        }))
                    };
                }).filter(Boolean);
            }

            return {
                id: cat.id,
                nombre: cat.nombre,
                orden: cat.orden,
                gruposOpciones: gruposOpcionesFormated,
                productos: prods.map(p => ({
                    id: p.id,
                    catId: cat.id,
                    nombre: p.nombre,
                    descripcion: p.descripcion,
                    precio: p.precio,
                    img: p.imagen_url,
                    visible: p.disponible,
                    orden: p.orden
                }))
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
    // Nos traemos los datos actuales para comparar y evitar duplicados
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

        const gruposListos = [];
        if (cat.gruposOpciones && cat.gruposOpciones.length > 0) {
            for (const grupo of cat.gruposOpciones) {
                let grupoId = grupo.id;

                // 2. GUARDAR GRUPO DE OPCIONES (EVITANDO DUPLICADOS DE NOMBRE)
                if (isNewItem(grupo.id)) {
                    // ¿Existe ya un grupo con este nombre en la base de datos?
                    const existente = dbCatOpciones.find(g => g.nombre.toLowerCase() === grupo.nombre.toLowerCase());

                    if (existente) {
                        grupoId = existente.id; // Usamos el que ya existe
                    } else {
                        const data = await fetchApi('/categoria-opcion', {
                            method: 'POST',
                            body: JSON.stringify({ nombre: String(grupo.nombre) })
                        });
                        grupoId = data?.id || data?.data?.id || (Array.isArray(data) && data[0]?.id);
                    }
                } else {
                    await fetchApi(`/categoria-opcion/${grupo.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ nombre: String(grupo.nombre) })
                    });
                }

                if (!grupoId) continue;

                // 3. GUARDAR OPCIONES (EVITANDO DUPLICADOS DE NOMBRE)
                for (const op of grupo.opciones) {
                    let opId = op.id;
                    const opPayload = {
                        id_categoria_opcion: Number(grupoId),
                        nombre: String(op.nombre),
                        precio_extra: Number(op.suplemento) || 0.00
                    };

                    if (isNewItem(op.id)) {
                        // ¿Existe ya esta opción en la base de datos?
                        const existente = dbOpciones.find(o => o.nombre.toLowerCase() === op.nombre.toLowerCase());

                        if (existente) {
                            opId = existente.id;
                            // Le hacemos PATCH por si el propietario le ha cambiado el precio
                            await fetchApi(`/opcion/${opId}`, { method: 'PATCH', body: JSON.stringify(opPayload) });
                        } else {
                            const data = await fetchApi('/opcion', { method: 'POST', body: JSON.stringify(opPayload) });
                            opId = data?.id || data?.data?.id || (Array.isArray(data) && data[0]?.id);
                        }
                    } else {
                        await fetchApi(`/opcion/${op.id}`, { method: 'PATCH', body: JSON.stringify(opPayload) });
                    }
                }

                gruposListos.push({ id: grupoId, obligatorio: grupo.obligatorio });
            }
        }

        // 4. GUARDAR PRODUCTOS Y ENLAZARLOS
        for (const prod of cat.productos) {
            let prodId = prod.id;
            const prodPayload = {
                id_categoria_producto: Number(catId),
                nombre: String(prod.nombre),
                descripcion: prod.descripcion ? String(prod.descripcion) : '',
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

            // 5. CREAR LA RELACIÓN EN LA TABLA PUENTE
            for (const [gListoIndex, gListo] of gruposListos.entries()) {
                const relPayload = {
                    id_producto: Number(prodId),
                    id_categoria_opcion: Number(gListo.id),
                    min_selecciones: gListo.obligatorio ? 1 : 0,
                    max_selecciones: gListo.obligatorio ? 1 : 10,
                    orden: gListoIndex // Previene el error de "null value in column orden"
                };

                try {
                    // Intentamos actualizar la relación
                    await fetchApi(`/producto-categoria-opcion/${prodId}/${gListo.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify(relPayload)
                    });
                } catch (e) {
                    try {
                        // Si falla es porque no existía, así que la creamos
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
    }
};

export const getProductosDisponibles = async () => {
    try {
        const data = await fetchApi('/producto') || [];
        return data.filter(p => p.visible !== false).sort((a, b) => a.orden - b.orden);
    } catch (error) {
        console.error('Error fetching productos:', error);
        return [];
    }
};