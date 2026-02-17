import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
        return NextResponse.json({ error });
    }

    if (!code) {
        return NextResponse.json({ error: 'No code provided' });
    }

    const redirectUri = 'http://localhost:3000/api/auth/callback';

    const auth = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        redirectUri
    );

    try {
        const { tokens } = await auth.getToken(code);

        return new NextResponse(`
        <html>
          <body style="font-family: sans-serif; padding: 2rem;">
            <h1 style="color: green;">Authentication Successful!</h1>
            <p>You have successfully authorized the application.</p>
            <div style="background: #f4f4f4; padding: 1rem; border-radius: 5px;">
                <h3>Your Refresh Token:</h3>
                <pre style="white-space: pre-wrap; word-break: break-all; font-weight: bold;">${tokens.refresh_token}</pre>
            </div>
            <p style="margin-top: 1rem;">
                <strong>Action Required:</strong> Copy the token above and paste it into your <code>.env.local</code> file as <code>GMAIL_REFRESH_TOKEN</code>.
            </p>
          </body>
        </html>
      `, { headers: { 'Content-Type': 'text/html' } });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, details: error.response?.data });
    }
}
