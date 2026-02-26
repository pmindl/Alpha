import { spawn, ChildProcess } from 'child_process';
import path from 'path';

// Configuration for Apps and MCP servers
const services = [
    // === SHARED (App + MCP) ===
    {
        name: 'master-app-mcp',
        cwd: 'apps/master',
        command: 'npm',
        args: ['run', 'dev'], // Port 3000
        color: '\x1b[36m' // Cyan
    },
    // === INVOICE PROCESSOR ===
    {
        name: 'inv-proc-app',
        cwd: 'apps/invoice-processor',
        command: 'npm',
        args: ['run', 'dev'], // Port 3002
        color: '\x1b[32m' // Green
    },
    {
        name: 'inv-proc-mcp',
        cwd: 'apps/invoice-processor',
        command: 'npm',
        args: ['run', 'mcp:sse'], // Port 4001
        color: '\x1b[92m' // Bright Green
    },
    // === INVOICE DOWNLOADER ===
    {
        name: 'inv-dl-app',
        cwd: 'apps/invoice-downloader',
        command: 'npm',
        args: ['run', 'dev'], // Port 3001
        color: '\x1b[33m' // Yellow
    },
    {
        name: 'inv-dl-mcp',
        cwd: 'apps/invoice-downloader',
        command: 'npm',
        args: ['run', 'mcp:sse'], // Port 4002
        color: '\x1b[93m' // Bright Yellow
    },
    // === GMAIL LABELER ===
    // Note: Python dev script runs a scheduler, not a web server, but good to run.
    {
        name: 'gmail-app',
        cwd: 'apps/gmail-labeler',
        command: 'npm',
        args: ['run', 'dev'],
        color: '\x1b[35m' // Magenta
    },
    {
        name: 'gmail-mcp',
        cwd: 'apps/gmail-labeler',
        command: 'npm',
        args: ['run', 'mcp:sse'], // Port 4003
        color: '\x1b[95m' // Bright Magenta
    },
    // === CUSTOMER RESPONDER ===
    {
        name: 'cust-resp-app',
        cwd: 'apps/customer-responder',
        command: 'npm',
        args: ['run', 'dev'], // Port 3004
        color: '\x1b[34m' // Blue
    },
    {
        name: 'cust-resp-mcp',
        cwd: 'apps/customer-responder',
        command: 'npm',
        args: ['run', 'mcp:sse'], // Port 4004
        color: '\x1b[94m' // Bright Blue
    }
];

const processes: ChildProcess[] = [];

console.log('🚀 Starting Alpha Full Stack (Apps + MCPs)...');
console.log('=============================================');

services.forEach(service => {
    const servicePath = path.resolve(process.cwd(), service.cwd);

    // Use npm.cmd on Windows, npm on others
    const cmd = process.platform === 'win32' ? `${service.command}.cmd` : service.command;

    console.log(`[${service.name}] Starting in ${service.cwd}...`);

    const child = spawn(cmd, service.args, {
        cwd: servicePath,
        env: { ...process.env, FORCE_COLOR: '1' },
        shell: true
    });

    processes.push(child);

    child.stdout?.on('data', (data) => {
        const lines = data.toString().trim().split('\n');
        lines.forEach((line: string) => {
            if (line.trim()) console.log(`${service.color}[${service.name}]\x1b[0m ${line}`);
        });
    });

    child.stderr?.on('data', (data) => {
        const lines = data.toString().trim().split('\n');
        lines.forEach((line: string) => {
            if (line.trim()) console.error(`${service.color}[${service.name}]\x1b[0m ${line}`);
        });
    });

    child.on('error', (err) => {
        console.error(`${service.color}[${service.name}] ERROR:\x1b[0m ${err.message}`);
    });

    child.on('exit', (code) => {
        console.log(`${service.color}[${service.name}] Exited with code ${code}\x1b[0m`);
    });
});

// Handle termination
const cleanup = () => {
    console.log('\n🛑 Shutting down all services...');
    processes.forEach(p => p.kill());
    process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
