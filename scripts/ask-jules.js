import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.agent', 'jules-mcp', '.env') });

const API_KEY = process.env.JULES_API_KEY;
const URL = 'http://localhost:3323/mcp/execute';

async function julesAPI(tool, parameters) {
    const res = await fetch(URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': API_KEY
        },
        body: JSON.stringify({ tool, parameters })
    });

    const text = await res.text();
    try {
        const data = JSON.parse(text);
        if (!res.ok) {
            throw new Error(`Jules API Error (HTTP ${res.status}): ${data.error || JSON.stringify(data)}`);
        }
        return data.result !== undefined ? data.result : data;
    } catch (e) {
        if (!res.ok) {
            throw new Error(`Jules API Error (HTTP ${res.status}): ${text}`);
        }
        throw new Error(`Parse error. Output was: ${text}`);
    }
}

const WAIT_TIME = 10000;

async function askJules() {
    try {
        console.log('1. Requesting Jules to analyze gmail-labeler for security and performance...');
        const sessionRes = await julesAPI('jules_create_session', {
            prompt: 'Please perform a security and performance check specifically on `apps/gmail-labeler/labeler.py` and `apps/gmail-labeler/gemini_client.py`. Generate a comprehensive plan with actionable feedback to improve the architecture. Do NOT execute the plan, just generate it.',
            source: 'sources/github/pmindl/Alpha',
            branch: 'master',
            requirePlanApproval: true
        });

        if (!sessionRes || !sessionRes.id) {
            console.log('Jules response format was weird:', sessionRes);
            return;
        }

        const sessionId = sessionRes.id;
        console.log(`✅ Session created! ID: ${sessionId}`);

        console.log(`2. Waiting for Jules to generate a plan...`);
        let isPlanning = true;

        while (isPlanning) {
            await new Promise(resolve => setTimeout(resolve, WAIT_TIME));

            const sessionData = await julesAPI('jules_get_session', { sessionId });

            // Unpack potential wrapping 
            const session = sessionData.session || sessionData;
            const status = session.status;

            console.log(`   Session State: ${status}`);

            if (!status) {
                console.log('   Raw session API response:', JSON.stringify(sessionData, null, 2));
            }

            if (status === 'AWAITING_APPROVAL') {
                isPlanning = false;
                console.log('\n✅ JULES ANALYSIS COMPLETE!');
                console.log('\n--- JULES SUGGESTIONS / PLAN SUMMARY ---');
                console.log(session.plan?.summary || session.plan || JSON.stringify(session, null, 2));
                console.log('----------------------------------------\n');

                // Clean up the session since we only wanted feedback anyway
                console.log('3. Canceling the session (feedback achieved)...');
                await julesAPI('jules_send_message', { sessionId, message: 'I will manually apply these changes. You can close this session.' });
                break;
            }

            if (status === 'FAILED' || status === 'COMPLETED') {
                isPlanning = false;
                console.log(`❌ Session ended abnormally with status ${status}`);
                process.exit(1);
            }
        }

    } catch (error) {
        console.error('Execution failed:', error.message);
    }
}

askJules();
