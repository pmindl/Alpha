import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const company = searchParams.get('company');

        const where = {
            ...(status && { status }),
            ...(company && { company }),
        };

        const invoices = await db.invoice.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json(invoices);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, status } = body;

        if (!id || !status) {
            return NextResponse.json({ error: 'Missing id or status' }, { status: 400 });
        }

        const updated = await db.invoice.update({
            where: { id },
            data: { status },
        });

        return NextResponse.json(updated);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
    }
}
