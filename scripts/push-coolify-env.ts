import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { VaultManager } from '../packages/security/src/vault';

const PROJ_ROOT = path.resolve(__dirname, '..');
const ENV_FILE = path.join(PROJ_ROOT, '.env');
const VAULT_PATH = path.join(PROJ_ROOT, 'secrets/vault.encrypted.json');

// Coolify API setup
const COOLIFY_URL = 'http://157.180.124.79:8000/api/v1';
const COOLIFY_TOKEN = '2|FhTzDYvmhGYCck3C6UscQSmPEjQ9eyKfL3UdEPsbdaf8a80f'; // From new subagent session

const APPS = [
    { name: 'master', id: 'master', uuid: 'ncgwsg004s48o0g0osg48wgg' },
    { name: 'invoice-downloader', id: 'invoice-downloader', uuid: 'd8s8g4088wgsww8kgg8g4s44' },
    { name: 'invoice-processor', id: 'invoice-processor', uuid: 'jc4s48ckw4skw4wwc4o804gs' },
    { name: 'customer-responder', id: 'customer-responder', uuid: 'dcws04g00ckw0ws0ogsw0k8s' },
    { name: 'gmail-labeler', id: 'gmail-labeler', uuid: 'j88ssos8gw8wo4gsgk0gwccw' }
];

async function updateCoolifyEnv(appUuid: string, key: string, value: string) {
    const res = await fetch(`${COOLIFY_URL}/applications/${appUuid}/envs`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${COOLIFY_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            key: key,
            value: value,
            is_preview: false,
            is_multiline: value.includes('\n')
        })
    });

    if (!res.ok) {
        const err = await res.text();
        console.error(`❌ Failed to set ${key} for ${appUuid}:`, err);
    }
}

async function main() {
    dotenv.config({ path: ENV_FILE });
    const MASTER_KEY = process.env.ALPHA_MASTER_KEY;

    if (!MASTER_KEY) {
        console.error('❌ ALPHA_MASTER_KEY not found in .env');
        process.exit(1);
    }

    // 1. Get secrets from vault
    const vault = new VaultManager(MASTER_KEY, VAULT_PATH);

    for (const app of APPS) {
        console.log(`\n🚀 Pushing secrets to Coolify for: ${app.name}`);

        let secrets: Record<string, string> = {};
        try {
            // master needs global plus its own
            secrets = vault.getEnvForApp(app.id === 'master' ? 'global' : app.id);
        } catch (e) {
            console.error(`Failed loading secrets for ${app.id}`, e);
        }

        // 2. Also manually read any local .env.* that aren't in vault for this app
        const appEnvPath = path.join(PROJ_ROOT, 'apps', app.name, '.env');
        const appEnvLocalPath = path.join(PROJ_ROOT, 'apps', app.name, '.env.local');

        for (const p of [appEnvPath, appEnvLocalPath]) {
            if (fs.existsSync(p)) {
                console.log(`  Reading local overrides from: ${path.basename(p)}`);
                const parsed = dotenv.parse(fs.readFileSync(p));
                secrets = { ...secrets, ...parsed };
            }
        }

        // Add APP_NAME and APP_PORT explicitly as build arg fallbacks just in case
        secrets['APP_NAME'] = app.name;

        const count = Object.keys(secrets).length;
        console.log(`  Found ${count} total variables`);

        // 3. Push to Coolify API
        for (const [key, value] of Object.entries(secrets)) {
            await updateCoolifyEnv(app.uuid, key, value);
        }
        console.log(`✅ Finished ${app.name}`);
    }
}

main().catch(console.error);
