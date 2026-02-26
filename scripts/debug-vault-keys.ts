import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config();
process.chdir(path.join(process.cwd(), 'apps', 'master'));

async function checkVault() {
    const { getVaultManager } = await import("../apps/master/src/lib/managers");
    const vault = getVaultManager();
    const creds = vault.listCredentials();
    console.log(creds.map(c => c.id).join(", "));
}

checkVault();
