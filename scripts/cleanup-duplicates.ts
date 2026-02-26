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

    const res = await fetch(url, { ...options, headers });
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        return null;
    }
}

async function main() {
    const VS = '5010590787';
    console.log(`>>> Starting Cleanup for VS: ${VS}`);

    // 1. Fetch all duplicates
    const data = await fetchSF(`/expenses/index.json/variable:${VS}`);

    // Handle both array (confirmed behavior) and object (documented behavior)
    let duplicates: any[] = [];
    if (Array.isArray(data)) {
        duplicates = data;
    } else if (data && data.error === 0 && Array.isArray(data.data)) {
        duplicates = data.data;
    }

    if (duplicates.length === 0) {
        console.log('No invoices found.');
        return;
    }

    console.log(`Found ${duplicates.length} invoices.`);

    // 2. Sort by ID (Assume lower ID = older)
    duplicates.sort((a, b) => parseInt(a.Expense.id) - parseInt(b.Expense.id));

    // 3. Identify Keep vs Delete
    const toKeep = duplicates[0];
    const toDelete = duplicates.slice(1);

    console.log(`KEEPING: ID ${toKeep.Expense.id} (Created: ${toKeep.Expense.created})`);

    if (toDelete.length === 0) {
        console.log('Nothing to delete.');
        return;
    }

    console.log('DELETING:');
    toDelete.forEach(d => console.log(` - ID ${d.Expense.id}`));

    // 4. Execute Delete
    for (const d of toDelete) {
        const id = d.Expense.id;
        console.log(`Deleting ID ${id}...`);
        // Endpoint: /expenses/delete/id
        const res = await fetchSF(`/expenses/delete/${id}`); // GET usually works for delete in SF API? Or POST?
        // documentation says: /expenses/delete/id
        if (res && res.error === 0) {
            console.log(' -> Deleted.');
        } else {
            console.log(' -> Failed:', res ? res.message : 'Unknown error');
        }
    }

    console.log('Cleanup Done.');
}

main().catch(console.error);
