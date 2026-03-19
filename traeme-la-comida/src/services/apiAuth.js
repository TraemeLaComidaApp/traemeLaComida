import { fetchApi } from './apiClient';

export const getCredenciales = async () => {
    try {
        const data = await fetchApi('/usuario');
        return data || [];
    } catch (error) {
        console.error('Error fetching credenciales:', error);
        return [];
    }
};

export const updateCredencial = async (rol, usuario, password, email) => {
    try {
        const allUsers = await fetchApi('/usuario');
        const existingUser = (allUsers || []).find(u => u.rol === rol);

        if (existingUser) {
            await fetchApi(`/usuario/${existingUser.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ usuario, password, email, rol })
            });
        } else {
            await fetchApi('/usuario', {
                method: 'POST',
                body: JSON.stringify({ usuario, password, email, rol })
            });
        }
    } catch (error) {
        console.error('Error updating credencial:', error);
        throw error;
    }
};

export const loginWithCredenciales = async (usuario, password, rolRequerido = null) => {
    try {
        const allUsers = await fetchApi('/usuario');
        const validUsers = (allUsers || []).filter(u => u.usuario === usuario && u.password === password);
        let user = validUsers[0];
        
        if (validUsers.length > 0 && rolRequerido) {
            user = validUsers.find(u => u.rol === rolRequerido);
        }

        if (user) {
            return { success: true, data: user };
        }
        return { success: false, data: null };
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, data: null };
    }
};

export const getConfiguracionLocal = async () => {
    try {
        const data = await fetchApi('/configuracion-local');
        return data && data.length > 0 ? data[0] : null;
    } catch (error) {
        console.error('Error fetching config:', error);
        return null; 
    }
};

export const updateConfiguracionLocal = async (configId, nombre_local, logo_url) => {
    try {
        if (configId) {
            await fetchApi(`/configuracion-local/${configId}`, {
                method: 'PATCH',
                body: JSON.stringify({ nombre_local, logo_url })
            });
        } else {
            await fetchApi('/configuracion-local', {
                method: 'POST',
                body: JSON.stringify({ nombre_local, logo_url })
            });
        }
    } catch (error) {
        console.error('Error updating config:', error);
        throw error;
    }
};
