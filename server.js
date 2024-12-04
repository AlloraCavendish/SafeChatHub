import express from 'express';
import axios from 'axios';
import cors from 'cors';  
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const app = express();
const port = process.env.PORT;

const API_KEY = process.env.API_KEY;
const API_URL = `https://ipqualityscore.com/api/json/url/${API_KEY}`;

const corsOptions = {
    origin: 'https://safechathub-wcr2.onrender.com',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
};
app.use(cors(corsOptions));

app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.use(express.static(join(__dirname, 'client/build')));

app.get('/check-url', async (req, res) => {
    try {
        const { url } = req.query;
        const response = await axios.get(API_URL, {
            params: { url: url, fast: true }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Error from API:', error.message);
        res.status(500).json({ success: false, message: 'Failed to check the URL.' });
    }
});

app.get('*', (req, res) => {
    res.sendFile(join(__dirname, 'client/build', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running on ${port}`);
});

console.log('API Response:', response.data);

