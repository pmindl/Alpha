const COOLIFY_TOKEN = '2|FhTzDYvmhGYCck3C6UscQSmPEjQ9eyKfL3UdEPsbdaf8a80f';
const URL = 'http://157.180.124.79:8000/api/v1/deploy';
const UUIDS = [
    { name: 'invoice-downloader', id: 'd8s8g4088wgsww8kgg8g4s44' },
    { name: 'invoice-processor', id: 'jc4s48ckw4skw4wwc4o804gs' },
    { name: 'gmail-labeler', id: 'j88ssos8gw8wo4gsgk0gwccw' },
    { name: 'customer-responder', id: 'dcws04g00ckw0ws0ogsw0k8s' }
];

async function deploy() {
    for (const app of UUIDS) {
        console.log(`Triggering deploy for ${app.name} (${app.id})...`);
        try {
            const res = await fetch(URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${COOLIFY_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ uuid: app.id, force_rebuild: true })
            });
            const data = await res.json();
            console.log(`Result for ${app.name}:`, data);
        } catch (e) {
            console.error(`Error triggering ${app.name}:`, e.message);
        }
    }
}
deploy();
