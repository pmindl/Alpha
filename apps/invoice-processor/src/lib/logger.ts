import { PrismaClient } from '@prisma/client';

// Use existing prisma instance if available, otherwise create new (but be careful with multiple instances in dev)
// Better to import db from existing lib if possible. 
// Let's assume we can import the singleton `db` from `@/lib/db` or passed in.
// actually, let's just use a passed-in prisma client or import it if we are in the app context.
// For scripts, we might not have `@/lib/db` easily available without path aliases working perfectly in tsx.
// So let's make a resilient logger that can take a client or create one.

// Using `any` for prisma client type to avoid strict dependency on the generated client version in this file
// (though in a real app we'd import `PrismaClient`)

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export async function logEvent(
    prisma: any,
    level: LogLevel,
    source: string,
    message: string,
    details?: any,
    invoiceId?: string
) {
    const timestamp = new Date();

    // 1. Console Output
    const logMsg = `[${timestamp.toISOString()}] [${level}] [${source}] ${message}`;
    if (level === 'ERROR') {
        console.error(logMsg, details ? details : '');
    } else if (level === 'WARN') {
        console.warn(logMsg, details ? details : '');
    } else {
        console.log(logMsg);
    }

    // 2. DB Save
    try {
        await prisma.processingLog.create({
            data: {
                level,
                source,
                message,
                details: details ? (typeof details === 'string' ? details : JSON.stringify(details)) : null,
                invoiceId,
                timestamp
            }
        });
    } catch (e) {
        console.error('Failed to write log to DB:', e);
    }
}
