const https = require('https');
const fs = require('fs');

const req = https.request({
    hostname: 'openrouter.ai',
    path: '/api/v1/models',
    method: 'GET',
    timeout: 60000
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const models = JSON.parse(data).data;

            // Filter completely free models (prompt: 0, completion: 0)
            const freeModels = models.filter(m =>
                m.pricing &&
                m.pricing.prompt === '0' &&
                m.pricing.completion === '0'
            );

            console.log('\n========== FREE AI MODELS FROM OPENROUTER ==========\n');
            freeModels.forEach(m => {
                console.log(`ID: ${m.id}`);
                console.log(`Name: ${m.name}`);
                console.log(`Context: ${m.context_length ? m.context_length.toLocaleString() : 'N/A'} tokens`);
                console.log(`Vision: ${m.architecture.input_modalities.includes('image') ? 'Yes' : 'No'}`);
                console.log('---');
            });

            console.log(`\nTotal FREE models: ${freeModels.length}`);

            // Save to file
            fs.writeFileSync('free_models.txt', freeModels.map(m => `${m.id} | ${m.name}`).join('\n'));
            console.log('\nSaved to free_models.txt');

        } catch (e) {
            console.error('Parse error:', e.message);
        }
    });
});

req.on('error', e => console.error('Request error:', e));
req.on('timeout', () => { req.destroy(); console.log('Timeout'); });
req.end();
