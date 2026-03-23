const COOLIFY_TOKEN = '2|FhTzDYvmhGYCck3C6UscQSmPEjQ9eyKfL3UdEPsbdaf8a80f';
const DEPLOY_UUIDS = {
  'invoice-downloader': 'skkgssosckk0ksswc0ws8o80',
  'invoice-processor': 'yg08sg4cwkkscs0wwkc4w4o0',
  'gmail-labeler': 'ascwsoo0w488ocgckwww0kw4',
  'customer-responder': 'ssoc0g0goc404wcgko4o80g0'
};

const MAX_WAIT_MS = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 10000;
const startTime = Date.now();

async function monitor() {
    console.log("Starting deployment monitor...");
    let pending = Object.keys(DEPLOY_UUIDS);
    let results = {};

    while (pending.length > 0 && (Date.now() - startTime) < MAX_WAIT_MS) {
        for (const app of [...pending]) {
            try {
                const uuid = DEPLOY_UUIDS[app];
                const res = await fetch(`http://157.180.124.79:8000/api/v1/deployments/${uuid}`, {
                    headers: { 'Authorization': `Bearer ${COOLIFY_TOKEN}` }
                });
                const data = await res.json();
                const status = data.status;
                
                if (status === 'finished' || status === 'failed') {
                    console.log(`[${app}] Completed with status: ${status}`);
                    results[app] = status;
                    pending = pending.filter(a => a !== app);
                } else {
                    console.log(`[${app}] Current status: ${status || 'unknown'}`);
                }
            } catch (e) {
                console.error(`[${app}] Error checking status: ${e.message}`);
            }
        }
        
        if (pending.length > 0) {
            await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
        }
    }
    
    if (pending.length > 0) {
        console.log(`Timeout reached. Still pending: ${pending.join(', ')}`);
    }
    
    console.log("Final Results:", results);
}
monitor();
