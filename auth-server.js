const { google } = require('googleapis');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Load env
const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split(/\r?\n/);
envLines.forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        process.env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
    }
});

const PORT = 5678;
const REDIRECT_URI = `http://localhost:${PORT}/rest/oauth2-credential/callback`;

console.log('Using Client ID:', process.env.GMAIL_CLIENT_ID);

const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    REDIRECT_URI
);

const scopes = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/gmail.readonly'
];

async function main() {
    // Generate the URL using the library to ensure encoding is correct
    // We add response_type explicitly just in case, though library handles it.
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent',
        response_type: 'code',
        include_granted_scopes: true
    });

    console.log('Generated Auth URL:', authUrl);

    const server = http.createServer(async (req, res) => {
        // Serve the start page at root
        if (req.url === '/') {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
                <html>
                    <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                        <h1>Authorize Invoice Downloader</h1>
                        <p>Click the button below to start the Google OAuth flow.</p>
                        <p>Scope: Gmail (Read-Only) + Drive (File Management)</p>
                        <br>
                        <a href="${authUrl}" style="background: #4285f4; color: white; padding: 15px 25px; text-decoration: none; border-radius: 5px; font-size: 18px;">Authorize with Google</a>
                        <p style="margin-top: 30px; font-size: 12px; color: #888;">Full URL for debugging: <br>${authUrl}</p>
                    </body>
                </html>
            `);
            return;
        }

        // Handle Callback
        if (req.url && req.url.startsWith('/rest/oauth2-credential/callback')) {
            const qs = new url.URL(req.url, `http://localhost:${PORT}`).searchParams;
            const code = qs.get('code');
            const error = qs.get('error');

            if (error) {
                res.end('Error: ' + error);
                console.error('Auth Error:', error);
                return;
            }

            if (code) {
                res.end('<h1>Success!</h1><p>You can close this window. Check your terminal.</p>');
                console.log('\n>>> Authorization Code Received!');

                try {
                    const { tokens } = await oauth2Client.getToken(code);
                    console.log('-------------------------------------------------------');
                    console.log('REFRESH_TOKEN:', tokens.refresh_token);
                    console.log('-------------------------------------------------------');
                } catch (err) {
                    console.error('Error exchanging token:', err);
                } finally {
                    // Give it a moment to send response before closing
                    setTimeout(() => {
                        server.close();
                        process.exit(0);
                    }, 1000);
                }
            }
        } else {
            res.writeHead(404);
            res.end('404 Not Found');
        }
    });

    server.listen(PORT, () => {
        console.log(`\nLocal Server running at http://localhost:${PORT}`);
        console.log('Opening browser to local start page...');

        const startCommand = process.platform === 'win32' ? 'start' :
            process.platform === 'darwin' ? 'open' : 'xdg-open';
        exec(`${startCommand} http://localhost:${PORT}`);
    });
}

main();
