import { NextRequest, NextResponse } from "next/server";
import { runSystemMaintenance } from "../../../../lib/autonomous";

export const dynamic = 'force-dynamic'; // Prevent static caching

export async function GET(req: NextRequest) {
    // Security: Check for Cron Secret
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    try {
        console.log("[Cron] Starting Autonomous Maintenance...");
        const result = await runSystemMaintenance(); // Defaults to configured repo

        return NextResponse.json({
            success: true,
            message: "Maintenance session started",
            data: result
        });
    } catch (error: any) {
        console.error("[Cron] Maintenance Failed:", error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
