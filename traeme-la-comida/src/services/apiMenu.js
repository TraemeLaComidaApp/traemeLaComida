import { fetchApi } from './apiClient';

export const getProductosDisponibles = async () => {
    try {
        const data = await fetchApi('/producto') || [];
        return data.filter(p => p.disponible).sort((a, b) => a.orden - b.orden);
    } catch (error) {
        console.error('Error fetching productos:', error);
        return [];
    }
};
