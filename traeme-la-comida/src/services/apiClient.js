export const API_BASE_URL = 'http://localhost:3000';

export const fetchApi = async (endpoint, options = {}) => {
    // Ensure endpoint starts with a slash
    const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${API_BASE_URL}${formattedEndpoint}`;
    
    // We can add auth headers here if needed later (e.g. from localStorage)
    const defaultHeaders = {
        'Content-Type': 'application/json',
    };

    // If body is FormData, don't set Content-Type so the browser sets it with boundaries
    if (options.body && options.body instanceof FormData) {
        delete defaultHeaders['Content-Type'];
    }

    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
    };

    try {
        const response = await fetch(url, config);
        
        if (!response.ok) {
            let errorMsg = response.statusText;
            try {
                const errorData = await response.json();
                errorMsg = errorData.message || errorData.error || errorMsg;
            } catch (e) {
                // Ignore JSON parsing error for error response
            }
            throw new Error(`Error ${response.status}: ${errorMsg}`);
        }

        // Return JSON if the response has it
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }
        
        return null; 
    } catch (error) {
        console.error(`API fetch error on ${endpoint}:`, error);
        throw error;
    }
};
