import { NextResponse } from 'next/server';
import { uploadFile } from '@/lib/gdrive';
import { getCompanyById, getCompanies } from '@/lib/companies';
import { secureCompare, validateFile, validateFileContent, sanitizeFilename } from '@alpha/security';

export async function POST(request: Request) {
    // Auth check for API usage using timing-safe comparison
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.split('Bearer ')[1] || '';

    if (!secureCompare(token, process.env.APP_API_KEY || '')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const companyId = formData.get('company') as string;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const fileValidation = validateFile(file);
        if (!fileValidation.valid) {
            return NextResponse.json({ error: fileValidation.error }, { status: 400 });
        }

        const company = getCompanyById(companyId);
        if (!company) {
            return NextResponse.json({ error: 'Invalid company' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        const contentValidation = validateFileContent(buffer, file.type);
        if (!contentValidation.valid) {
            return NextResponse.json({ error: contentValidation.error }, { status: 400 });
        }

        const safeFilename = sanitizeFilename(file.name);

        const fileId = await uploadFile(
            safeFilename,
            file.type,
            buffer,
            company.gdriveFolderId
        );

        return NextResponse.json({ success: true, fileId });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
