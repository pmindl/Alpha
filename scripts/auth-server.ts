import { google } from 'googleapis';
import http from 'http';
import url from 'url';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const PORT = 5678;
const REDIRECT_URI = `http://localhost:${PORT}/rest/oauth2-credential/callback`;

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
);

const scopes = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/gmail.readonly'
];

async function main() {
    const server = http.createServer(async (req, res) => {
        if (req.url?.startsWith('/rest/oauth2-credential/callback')) {
            const qs = new url.URL(req.url, `http://localhost:${PORT}`).searchParams;
            const code = qs.get('code');
            const error = qs.get('error');

            if (error) {
                res.end('Authentication failed! Error: ' + error);
                console.error('Error:', error);
                server.close();
                return;
            }

            if (code) {
                res.end('Authentication successful! You can close this window. Check your terminal.');
                console.log('\n>>> Authorization Code Received! Exchanging for token...');

                try {
                    const { tokens } = await oauth2Client.getToken(code);
                    console.log('\n>>> Tokens Received:', tokens);

                    if (tokens.refresh_token) {
                        updateEnvFile(tokens.refresh_token);
                        console.log('\n>>> SUCCESS! GOOGLE_REFRESH_TOKEN has been saved to .env');
                    } else {
                        console.log('\n>>> WARNING: No refresh token returned. This happens if you have already authorized the app. Go to https://myaccount.google.com/permissions and revoke access for this app, then try again.');
                    }
                } catch (err) {
                    console.error('Error exchanging token:', err);
                } finally {
                    server.close();
                    process.exit(0);
                }
            }
        } else {
            res.end('404 Not Found');
        }
    });

    server.listen(PORT, () => {
        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            prompt: 'consent' // Force refresh token generation
        });

        console.log(`\nLocal Server listening on port ${PORT}`);
        console.log('-------------------------------------------------------');
        console.log('Please click the link below to authorize:');
        console.log(authUrl);
        console.log('-------------------------------------------------------');
        console.log('Waiting for callback...');
    });
}

function updateEnvFile(refreshToken: string) {
    const envPath = path.resolve(process.cwd(), '.env');
    let envContent = fs.readFileSync(envPath, 'utf-8');

    if (envContent.includes('GOOGLE_REFRESH_TOKEN=')) {
        envContent = envContent.replace(
            /GOOGLE_REFRESH_TOKEN=.*/,
            `GOOGLE_REFRESH_TOKEN="${refreshToken}"`
        );
    } else {
        envContent += `\nGOOGLE_REFRESH_TOKEN="${refreshToken}"`;
    }

    fs.writeFileSync(envPath, envContent);
}

main();
