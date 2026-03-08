import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const invoice = await db.invoice.findUnique({
            where: { id: resolvedParams.id },
            include: {
                logs: {
                    orderBy: { timestamp: 'desc' }
                }
            }
        });

        if (!invoice) {
            return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
        }

        return NextResponse.json(invoice);
    } catch (error) {
        console.error('Invoice Detail API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch invoice detail' }, { status: 500 });
    }
}
