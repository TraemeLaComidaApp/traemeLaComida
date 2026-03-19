import { fetchApi } from './apiClient';

export const getSalasConMesas = async () => {
    try {
        const salasData = await fetchApi('/sala') || [];
        const mesasData = await fetchApi('/mesa') || [];

        salasData.sort((a, b) => a.id - b.id);

        return salasData.map(sala => ({
            id: sala.id,
            nombre: sala.nombre,
            anchoSala: sala.ancho || 800,
            altoSala: sala.alto || 500,
            elementos: mesasData
                .filter(m => m.id_sala === sala.id)
                .map(m => ({
                    id: m.id,
                    tipo: m.tipo,
                    numero: m.numero,
                    pos_x: m.pos_x,
                    pos_y: m.pos_y,
                    ancho: m.ancho,
                    alto: m.alto,
                    rotacion: m.rotacion,
                    uuid: m.uuid
                }))
        }));
    } catch (error) {
        console.error('Error fetching salas:', error);
        return [];
    }
};

export const guardarPlanoCompleto = async (salas) => {
    const dbSalas = await fetchApi('/sala') || [];
    const dbMesas = await fetchApi('/mesa') || [];

    const dbSalasIds = dbSalas.map(s => s.id);
    const dbMesasIds = dbMesas.map(m => m.id);

    const isNewItem = (id) => typeof id === 'number' && id > 1000000000000;

    const uiSalasIds = salas.filter(s => !isNewItem(s.id)).map(s => s.id);
    const uiMesasIds = salas.flatMap(s => s.elementos).filter(m => !isNewItem(m.id)).map(m => m.id);

    const salasToDelete = dbSalasIds.filter(id => !uiSalasIds.includes(id));
    const mesasToDelete = dbMesasIds.filter(id => !uiMesasIds.includes(id));

    // Delete removed mesas first to respect foreign keys
    for (const id of mesasToDelete) {
        await fetchApi(`/mesa/${id}`, { method: 'DELETE' });
    }

    // Delete removed salas
    for (const id of salasToDelete) {
        await fetchApi(`/sala/${id}`, { method: 'DELETE' });
    }

    // Upsert Salas and Mesas
    for (const sala of salas) {
        let salaRealId = sala.id;

        if (isNewItem(sala.id)) {
            const newSala = await fetchApi('/sala', {
                method: 'POST',
                body: JSON.stringify({ nombre: sala.nombre, ancho: Number(sala.anchoSala), alto: Number(sala.altoSala) })
            });
            salaRealId = newSala.id;
        } else {
            await fetchApi(`/sala/${sala.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ nombre: sala.nombre, ancho: Number(sala.anchoSala), alto: Number(sala.altoSala) })
            });
        }

        for (const mesa of sala.elementos) {
            const mesaPayload = {
                id_sala: Number(salaRealId),
                tipo: String(mesa.tipo),
                numero: String(mesa.numero),
                pos_x: Math.round(mesa.pos_x),
                pos_y: Math.round(mesa.pos_y),
                ancho: Number(mesa.ancho),
                alto: Number(mesa.alto),
                rotacion: Number(mesa.rotacion),
                uuid: mesa.uuid || ''
            };

            if (isNewItem(mesa.id)) {
                await fetchApi('/mesa', {
                    method: 'POST',
                    body: JSON.stringify(mesaPayload)
                });
            } else {
                await fetchApi(`/mesa/${mesa.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(mesaPayload)
                });
            }
        }
    }
};
