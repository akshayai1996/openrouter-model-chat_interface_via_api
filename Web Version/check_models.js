const fs = require('fs');
const fetch = require('node-fetch');

async function checkModels(apiKey) {
    if (!apiKey) {
        console.error("API Key is missing!");
        process.exit(1);
    }

    console.log("Reading free_models.txt...");

    let fileContent;
    try {
        fileContent = fs.readFileSync('free_models.txt', 'utf8');
    } catch (e) {
        console.error("Could not read free_models.txt. Make sure the file exists.");
        return;
    }

    const lines = fileContent.split('\n').filter(line => line.trim() !== '');
    const models = lines.map(line => {
        const parts = line.split('|');
        return {
            id: parts[0].trim(),
            name: parts[1] ? parts[1].trim() : parts[0].trim()
        };
    });

    console.log(`Found ${models.length} models. Starting check...`);
    console.log("--------------------------------------------------");

    // Run concurrently
    const TIMEOUT_MS = 30000;

    const checkModel = async (model) => {
        console.log(`Checking: ${model.name} (${model.id})...`);
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "HTTP-Referer": "http://localhost:3000",
                    "X-Title": "Model Checker",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    "model": model.id,
                    "messages": [
                        { "role": "user", "content": "Explain yourself in one sentence." }
                    ]
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                if (data.choices && data.choices.length > 0 && data.choices[0].message.content) {
                    console.log(`✅ ALIVE: ${model.name}`);
                    return model;
                } else {
                    console.log(`❌ DEAD (No Content): ${model.name}`);
                    return null;
                }
            } else {
                console.log(`❌ DEAD (Status ${response.status}): ${model.name}`);
                return null;
            }
        } catch (error) {
            console.log(`❌ DEAD (Error): ${model.name} - ${error.message}`);
            return null;
        }
    };

    const results = await Promise.all(models.map(m => checkModel(m)));
    const workingModels = results.filter(m => m !== null);
    const deadModelsCount = models.length - workingModels.length;

    console.log("\n================ REPORT ================");
    console.log(`Total Checked: ${models.length}`);
    console.log(`Working: ${workingModels.length}`);
    console.log(`Dead: ${deadModelsCount}`);

    console.log("\nUpdating free_models.txt with ONLY working models...");
    const newFileContent = workingModels.map(m => `${m.id} | ${m.name}`).join('\n');
    fs.writeFileSync('free_models.txt', newFileContent);
    console.log("Done!");

    console.log("\nRecommended HTML Options:");
    workingModels.forEach(m => {
        console.log(`<option value="${m.id}">${m.name}</option>`);
    });
}

// Try to read API Key
let apiKey = '';
try {
    // Check multiple locations
    if (fs.existsSync('APIKEY.txt')) {
        apiKey = fs.readFileSync('APIKEY.txt', 'utf8').trim();
    } else if (fs.existsSync('../APIKEY.txt')) {
        apiKey = fs.readFileSync('../APIKEY.txt', 'utf8').trim();
    } else {
        console.error("FATAL: APIKEY.txt not found! Please create it with your OpenRouter key.");
        process.exit(1);
    }
} catch (e) {
    console.error("Error reading API key:", e.message);
    process.exit(1);
}

// Pass api key to the function
checkModels(apiKey);
