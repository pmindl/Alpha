const fs = require('fs');
const path = require('path');

// manually parse env
function loadEnv() {
    try {
        const envPath = path.join(process.cwd(), '.env.local'); // Use process.cwd() as it's safer for CLI
        console.log("Loading .env from:", envPath);
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf8');
            console.log("File content length:", content.length);
            const lines = content.split(/\r?\n/); // Handle CRLF
            lines.forEach(line => {
                const match = line.match(/^([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    const value = match[2].trim().replace(/^['"]|['"]$/g, ''); // strip quotes
                    process.env[key] = value;
                }
            });
        } else {
            console.error("File not found:", envPath);
        }
    } catch (e) {
        console.error("Error loading .env.local", e);
    }
}

loadEnv();

async function main() {
    const key = process.env.GEMINI_API_KEY;
    console.log("Key loaded:", key ? "Yes (starts with " + key.substring(0, 5) + "...)" : "No");

    if (!key) {
        console.error("No API Key found. Check .env.local");
        return;
    }

    try {
        // Direct fetch to API to list models
        // Using v1beta as expected by the library
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            console.error("API Error:", JSON.stringify(data.error, null, 2));
        } else {
            console.log("Available Models:");
            if (data.models) {
                data.models.forEach(m => console.log(`- ${m.name}`));
            } else {
                console.log("No models returned", JSON.stringify(data, null, 2));
            }
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

main();
