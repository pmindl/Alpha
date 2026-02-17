import { google } from 'googleapis';
import { CompanyConfig } from './types';

const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

auth.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const drive = google.drive({ version: 'v3', auth });

export async function listFiles(folderId: string) {
    const res = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType, createdTime)',
    });
    return res.data.files || [];
}

export async function downloadFile(fileId: string): Promise<{ buffer: Buffer; mimeType: string; name: string }> {
    const fileParams = await drive.files.get({ fileId, fields: 'name, mimeType' });

    const res = await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'arraybuffer' }
    );

    return {
        buffer: Buffer.from(res.data as ArrayBuffer),
        mimeType: fileParams.data.mimeType || 'application/octet-stream',
        name: fileParams.data.name || 'unknown',
    };
}

export async function uploadFile(
    name: string,
    mimeType: string,
    buffer: Buffer,
    folderId: string
) {
    const stream = require('stream');
    const bufferStream = new stream.PassThrough();
    bufferStream.end(buffer);

    const res = await drive.files.create({
        requestBody: {
            name,
            parents: [folderId],
        },
        media: {
            mimeType,
            body: bufferStream,
        },
        fields: 'id',
    });

    return res.data.id;
}

export async function moveFile(fileId: string, oldFolderId: string, newFolderId: string) {
    // Determine previous parents to remove
    const file = await drive.files.get({
        fileId: fileId,
        fields: 'parents'
    });

    // Move the file by adding the new parent and removing the old one
    const previousParents = file.data.parents?.join(',') || '';

    await drive.files.update({
        fileId: fileId,
        addParents: newFolderId,
        removeParents: previousParents,
        fields: 'id, parents'
    });
}
