import axios from 'axios';

// Use an environment variable to switch between local and production URLs
const API_PROXY_URL = process.env.REACT_APP_API_URL || 'https://your-production-url.com/check-url'; // Replace with your deployed backend URL

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
