import { NextResponse } from 'next/server';
import { getCompanies } from '@/lib/companies';

export async function GET() {
    try {
        const companies = getCompanies();
        return NextResponse.json(companies.map(c => ({
            id: c.id,
            name: c.name,
            ico: c.ico
        })));
    } catch (error) {
        console.error('Companies API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 });
    }
}
