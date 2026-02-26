import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config();

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob'
);

async function getToken(code: string) {
    const { tokens } = await oauth2Client.getToken(code);
    console.log('Tokens:', tokens);
    if (tokens.refresh_token) {
        console.log('Refresh Token:', tokens.refresh_token);
        console.log('Add this token to your .env file as GOOGLE_REFRESH_TOKEN');
    } else {
        console.log('No refresh token returned. Did you already authorize app? try revoking access first.');
    }
}

const code = process.argv[2];
if (!code) {
    console.error('Usage: npx tsx scripts/get-token.ts <code>');
    process.exit(1);
}

getToken(code);
