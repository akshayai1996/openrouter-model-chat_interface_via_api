const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
// Increase payload size limit for base64 images
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static('public'));

// Helper to read API Key
const getApiKey = () => {
    try {
        const keyPath = path.join(__dirname, '..', 'APIKEY.txt');
        if (fs.existsSync(keyPath)) {
            return fs.readFileSync(keyPath, 'utf8').trim();
        }
    } catch (err) {
        console.error("Error reading API key:", err);
    }
    return null;
};

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Chat Endpoint - Streaming
app.post('/api/chat', async (req, res) => {
    const apiKey = getApiKey();
    if (!apiKey) {
        console.error("API Key missing");
        return res.status(500).json({ error: 'API Key not found on server' });
    }

    const { messages, model } = req.body;
    console.log(`[Request] Model: ${model}, Messages: ${messages?.length}`);

    if (!messages || !model) {
        return res.status(400).json({ error: 'Missing messages or model' });
    }

    try {
        // Dynamic fetch import if not available globally
        let fetchFn = global.fetch;
        if (!fetchFn) {
            try {
                fetchFn = (await import('node-fetch')).default;
            } catch (e) {
                console.error("Fetch not found. Install node-fetch or use Node 18+");
                return res.status(500).json({ error: 'Server configuration error: fetch not available' });
            }
        }

        const response = await fetchFn('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'Local AI Chat',
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                stream: true
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`OpenRouter Error (${response.status}):`, errorText);
            return res.status(response.status).json({ error: 'Provider Error', details: errorText });
        }

        // Set Headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        // Node.js Stream Handling
        // Handle both Web Streams (native fetch) and Node Streams (node-fetch)
        const stream = response.body;

        if (stream.getReader) {
            // Web Stream (Native Node 18+ fetch)
            const reader = stream.getReader();

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    res.end();
                    break;
                }
                // value is Uint8Array, write directly to response
                // Express res.write accepts Uint8Array/Buffer
                res.write(value);
            }
        } else {
            // Node Stream (node-fetch or older)
            for await (const chunk of stream) {
                // chunk is Buffer/String, write directly
                res.write(chunk);
            }
            res.end();
        }

    } catch (error) {
        console.error("Server Exception:", error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal Server Error', details: error.message });
        } else {
            res.end();
        }
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
