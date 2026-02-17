import { google } from 'googleapis';
import { oauth2Client } from './auth';
import { Readable } from 'stream';
import { DriveUploadResult } from './types';

const drive = google.drive({ version: 'v3', auth: oauth2Client });



export async function findFile(name: string, folderId: string): Promise<{ id: string } | null> {
    try {
        const res = await drive.files.list({
            q: `name = '${name}' and '${folderId}' in parents and trashed = false`,
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

export async function upsertFile(
    fileName: string,
    mimeType: string,
    content: Buffer | Readable,
    folderId: string = '1T7Ew6PoJn8EcFb-9kiR2NaVAp_SRMU6R'
): Promise<DriveUploadResult> {
    const existingFile = await findFile(fileName, folderId);

    const media = {
        mimeType: mimeType,
        body: content instanceof Buffer ? Readable.from(content) : content
    };

    try {
        if (existingFile) {
            console.log(`File '${fileName}' exists (ID: ${existingFile.id}). Updating...`);
            const res = await drive.files.update({
                fileId: existingFile.id,
                media: media,
                fields: 'id, webViewLink, name'
            });

            if (!res.data.id || !res.data.webViewLink || !res.data.name) {
                throw new Error('Update failed: missing response data');
            }

            return {
                fileId: res.data.id,
                webViewLink: res.data.webViewLink,
                name: res.data.name,
                isUpdate: true
            };
        } else {
            console.log(`File '${fileName}' does not exist. Creating new...`);
            const fileMetadata = {
                name: fileName,
                parents: [folderId]
            };

            const res = await drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: 'id, webViewLink, name'
            });

            if (!res.data.id || !res.data.webViewLink || !res.data.name) {
                throw new Error('Upload failed: missing response data');
            }

            return {
                fileId: res.data.id,
                webViewLink: res.data.webViewLink,
                name: res.data.name,
                isUpdate: false
            };
        }
    } catch (error) {
        console.error(`Error upserting file ${fileName}:`, error);
        throw error;
    }
}
