import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config();

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob'
);

const scopes = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/gmail.readonly'
];

const url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // crucial for refresh token
    scope: scopes
});

console.log('\n--- AUTH URL START ---');
console.log(url);
console.log('--- AUTH URL END ---\n');
console.log('1. Open the URL above.');
console.log('2. Authorize the app.');
console.log('3. Copy the code provided by Google.');
console.log('4. Paste the code here.');
