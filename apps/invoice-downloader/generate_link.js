const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

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

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const PORT = 5678;
const REDIRECT_URI = `http://localhost:${PORT}/rest/oauth2-credential/callback`;

console.log('Client ID length:', CLIENT_ID.length); // Check for hidden chars

const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
);

const scopes = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/gmail.readonly'
];

const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
    response_type: 'code'
});

const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Authorize Invoice Downloader</title>
    <style>
        body { font-family: sans-serif; padding: 40px; text-align: center; }
        .btn {
            display: inline-block;
            background-color: #4285f4;
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 5px;
            font-size: 18px;
            margin-top: 20px;
        }
        .url {
            word-break: break-all;
            color: #666;
            margin-top: 20px;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <h1>Authorization Required</h1>
    <p>Please click the button below to authorize the application with Google.</p>
    <p>Scope: Gmail (Read-Only) + Drive (File Management)</p>
    
    <a href="${authUrl}" class="btn" target="_blank">Authorize with Google</a>
    
    <div class="url">
        Full URL: ${authUrl}
    </div>
</body>
</html>
`;

fs.writeFileSync('auth_link.html', htmlContent);
console.log('Created auth_link.html');

// Also update auth-server.js to JUST listen, not open
const authServerContent = `
const { google } = require('googleapis');
const http = require('http');
const url = require('url');

const PORT = 5678;

async function main() {
    const server = http.createServer(async (req, res) => {
        if (req.url && req.url.startsWith('/rest/oauth2-credential/callback')) {
            const qs = new url.URL(req.url, \`http://localhost:\${PORT}\`).searchParams;
            const code = qs.get('code');
            if (code) {
                res.end('Success! You can close this window.');
                console.log('REFRESH_TOKEN_CODE:' + code);
                // We will exchange this manually or in the other script
                // For now just print it clearly
                try {
                     // We need to re-initialize oauth client here to exchange
                     // But let's just output the code first
                } catch (e) {}
            }
        } else {
            res.end('404');
        }
    });
    server.listen(PORT, () => {
        console.log('Listening for callback on port ' + PORT);
    });
}
main();
`;
// We will reuse the existing auth-server.js but modify it slightly to just listen
