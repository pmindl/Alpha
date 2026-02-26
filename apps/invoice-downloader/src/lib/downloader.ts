import axios from 'axios';

export async function downloadFile(url: string): Promise<{ data: Buffer, mimeType: string, filename: string | null }> {
    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 30000 // 30s timeout
        });

        const contentType = response.headers['content-type'] || 'application/octet-stream';

        // try to extract filename from content-disposition
        const contentDisposition = response.headers['content-disposition'];
        let filename = null;
        if (contentDisposition) {
            const match = contentDisposition.match(/filename="?([^"]+)"?/);
            if (match && match[1]) filename = match[1];
        }

        // Fallback filename from URL
        if (!filename) {
            try {
                const urlObj = new URL(url);
                const pathParts = urlObj.pathname.split('/');
                const lastPart = pathParts[pathParts.length - 1];
                if (lastPart && lastPart.length > 0) {
                    filename = lastPart;
                }
            } catch (e) {
                // simple split if URL parsing fails
                const urlParts = url.split('/');
                filename = urlParts[urlParts.length - 1].split('?')[0];
            }
        }

        if (!filename) filename = 'downloaded_file';

        return {
            data: Buffer.from(response.data),
            mimeType: contentType,
            filename
        };
    } catch (error) {
        console.error('Error downloading file from URL:', url, error);
        throw error;
    }
}
