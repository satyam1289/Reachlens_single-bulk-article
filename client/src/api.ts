const API_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const analyzeUrl = async (url: string, version: string = 'v5') => {
    const response = await fetch(`${API_URL}/analyze`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, version }),
    });
    return await response.json();
};

export const analyzeBulk = async (file: File, version: string = 'v5') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('version', version);

    const response = await fetch(`${API_URL}/analyze-bulk`, {
        method: 'POST',
        body: formData,
    });
    
    if (!response.ok) {
        throw new Error('Bulk analysis failed');
    }
    
    return await response.blob();
};
