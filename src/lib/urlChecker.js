import axios from 'axios';

const API_PROXY_URL = 'http://localhost:3001/check-url';

export const checkUrlSafety = async (url) => {
    try {
        const response = await axios.get(API_PROXY_URL, {
            params: {
                url: url,
                fast: true
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error checking URL:', error.message);
        throw new Error('Failed to check the URL.');
    }
};
