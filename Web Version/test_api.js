// No require needed for Node 18+
async function test() {
    try {
        console.log("Testing API...");
        const res = await fetch('http://localhost:3000/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'nvidia/nemotron-3-nano-30b-a3b:free', // Use the free model
                messages: [{ role: 'user', content: 'Say hello!' }]
            })
        });

        console.log("Status:", res.status);

        // Handle streaming response
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            console.log("Chunk:", chunk);
            fullResponse += chunk;
        }

        console.log("Full response received!");

    } catch (error) {
        console.error("Test Error:", error);
    }
}

test();
