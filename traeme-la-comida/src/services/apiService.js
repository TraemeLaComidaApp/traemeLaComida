import { fetchApi } from './apiClient';

export const obtenerMesas = async () => {
    try {
        const data = await fetchApi('/mesa');
        return data || [];
    } catch (error) {
        console.error("Error obtaining mesas:", error);
        return [];
    }
};