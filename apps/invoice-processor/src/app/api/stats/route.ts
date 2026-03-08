import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
    try {
        const stats = await db.invoice.groupBy({
            by: ['status'],
            _count: {
                _all: true
            }
        });

        const counts = {
            TOTAL: 0,
            PENDING: 0,
            EXPORTED: 0,
            ERROR: 0,
            DUPLICATE: 0,
            SKIPPED: 0
        };

        stats.forEach(stat => {
            const status = stat.status as keyof typeof counts;
            counts[status] = stat._count._all;
            counts.TOTAL += stat._count._all;
        });

        // Group export errors together for the dashboard
        const dashboardStats = {
            total: counts.TOTAL,
            exported: counts.EXPORTED,
            pending: counts.PENDING,
            errors: (counts as any).EXPORT_ERROR || 0 // fallback if status is specific
        };

        // Let's also get the specific counts for more granular display
        const granular = await db.invoice.groupBy({
            by: ['status'],
            _count: true
        });

        return NextResponse.json({
            summary: dashboardStats,
            granular: granular
        });
    } catch (error) {
        console.error('Stats API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }
}
