import { google } from 'googleapis';
import { getGoogleAuth } from '@alpha/google-auth';
import { Readable } from 'stream';
import { DriveUploadResult } from './types';
import { escapeDriveQueryString } from './utils';

/**
 * Singleton client initialized on first use to ensure process.env is ready.
 */
let _drive: any = null;
function getDriveClient() {
    if (!_drive) {
        _drive = google.drive({ version: 'v3', auth: getGoogleAuth() });
    }
    return _drive;
}

export async function findFile(name: string, folderId: string): Promise<{ id: string } | null> {
    try {
        const drive = getDriveClient();
        const safeName = escapeDriveQueryString(name);
        const res = await drive.files.list({
            q: `name = '${safeName}' and '${folderId}' in parents and trashed = false`,
            fields: 'files(id, name)',
            pageSize: 1
        });

        if (res.data.files && res.data.files.length > 0) {
            return { id: res.data.files[0].id! };
        }
        return null;
    } catch (error) {
        console.error('Error finding file:', error);
        return null;
    }
}

export async function listFiles(folderId: string) {
    const drive = getDriveClient();
    const res = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType, createdTime)',
    });
    return res.data.files || [];
}

export async function downloadFile(fileId: string): Promise<{ buffer: Buffer; mimeType: string; name: string }> {
    const drive = getDriveClient();
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
    buffer: Buffer | Readable,
    folderId: string
): Promise<DriveUploadResult> {
    const drive = getDriveClient();
    const existingFile = await findFile(name, folderId);

    const media = {
        mimeType: mimeType,
        body: buffer instanceof Buffer ? Readable.from(buffer) : buffer
    };

    try {
        if (existingFile) {
            console.log(`File '${name}' exists (ID: ${existingFile.id}). Updating...`);
            const res = await drive.files.update({
                fileId: existingFile.id,
                media: media,
                fields: 'id, webViewLink, name'
            });

            return {
                fileId: res.data.id!,
                webViewLink: res.data.webViewLink!,
                name: res.data.name!,
                isUpdate: true
            };
        } else {
            console.log(`File '${name}' does not exist. Creating new...`);
            const res = await drive.files.create({
                requestBody: {
                    name,
                    parents: [folderId],
                },
                media: media,
                fields: 'id, webViewLink, name'
            });

            return {
                fileId: res.data.id!,
                webViewLink: res.data.webViewLink!,
                name: res.data.name!,
                isUpdate: false
            };
        }
    } catch (error) {
        console.error(`Error uploading file ${name}:`, error);
        throw error;
    }
}
