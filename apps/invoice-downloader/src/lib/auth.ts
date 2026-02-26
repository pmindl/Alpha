import { google } from 'googleapis';

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;

export const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);

if (REFRESH_TOKEN) {
    oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
} else {
    // If no refresh token, checks for ADC (Application Default Credentials)
    // This is useful if running on GCP or with a service account key file
    const auth = new google.auth.GoogleAuth({
        scopes: [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/drive.file'
        ]
    });
    // We can't easily mix OAuth2Client and GoogleAuth in the same export expecting same interface
    // But google.options({ auth }) can handle it globally if we wanted.
    // For now, simpler to stick to the plan: OAuth2 for personal, or if env vars are set.
    // If running in cloud, we might want GoogleAuth. 
    // Let's keep it simple for now based on the env vars approach.
}
