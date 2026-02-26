import { NextResponse } from 'next/server';
import { uploadFile } from '@/lib/gdrive';
import { getCompanyById, getCompanies } from '@/lib/companies';

export async function POST(request: Request) {
    // Auth check for API usage (manual upload from UI might need proxy or key)
    // For simplicity, UI proxy or direct key if available.
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.APP_API_KEY}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const companyId = formData.get('company') as string;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const company = getCompanyById(companyId);
        if (!company) {
            return NextResponse.json({ error: 'Invalid company' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        const fileId = await uploadFile(
            file.name,
            file.type,
            buffer,
            company.gdriveFolderId
        );

        return NextResponse.json({ success: true, fileId });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
