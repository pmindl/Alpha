import dotenv from 'dotenv';
dotenv.config();

const API_CONFIG = {
    get baseUrl() { return process.env.SF_BASE_URL || 'https://moje.superfaktura.cz'; },
    get auth() {
        return `SFAPI email=${process.env.SF_API_EMAIL}&apikey=${process.env.SF_API_KEY}&company_id=${process.env.SF_COMPANY_ID}`;
    }
};

async function fetchSF(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${API_CONFIG.baseUrl}${endpoint}`;
    const headers = {
        'Authorization': API_CONFIG.auth,
        ...options.headers
    };

    console.log(`\n[Request] GET ${url}`);
    try {
        const res = await fetch(url, { ...options, headers });
        const text = await res.text();
        console.log(`[Response] Status: ${res.status}`);
        console.log(`[Response] Body: ${text.substring(0, 1000)}`); // Print first 1000 chars

        try {
            return JSON.parse(text);
        } catch (e) {
            console.log('[Response] Not JSON');
            return null;
        }
    } catch (err) {
        console.error('[Network Error]', err);
        return null;
    }
}



async function main() {
    const VS = '2508131691';
    console.log(`>>> Debugging SF Search for VS: ${VS}`);

    // Test 1: n8n Logic
    const encoded = Buffer.from(VS).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ',');
    const endpoint = `/expenses/index.json/listinfo:0/created:3/created_since:01.01.2020/created_to:31.12.2030/search:${encoded}`;
    console.log(`--- Test n8n Logic: ${endpoint} ---`);
    const res = await fetchSF(endpoint);
    console.log('n8n Response:', JSON.stringify(res).substring(0, 100));

    // Test 2: List Recent 50 (Simulation of Fallback)
    console.log('--- Test 2: List Recent 50 ---');
    const recent = await fetchSF('/expenses/index.json/limit:50/sort:created/direction:desc');

    let items: any[] = [];
    if (Array.isArray(recent)) items = recent;
    else if (recent && recent.data) items = recent.data;
    else if (recent && recent.items) items = recent.items; // Just in case

    console.log(`Fetched ${items.length} items.`);

    const found = items.find((item: any) => {
        const exp = item.Expense || item;
        return String(exp.variable) === VS;
    });

    if (found) {
        console.log(`>>> FOUND in Recent 50! ID: ${found.Expense?.id || found.id}`);
    } else {
        console.log('>>> NOT FOUND in Recent 50.');
    }
}

main().catch(console.error);
