import axios from 'axios';
import { isValidUrl } from './ssrf';

export async function downloadFile(url: string): Promise<{ data: Buffer, mimeType: string, filename: string | null }> {
    let currentUrl = url;
    let hops = 0;
    const maxHops = 5;

    try {
        while (hops < maxHops) {
            // Validate URL before making a request
            if (!await isValidUrl(currentUrl)) {
                throw new Error(`Invalid or unsafe URL: ${currentUrl}`);
            }

            const response = await axios.get(currentUrl, {
                responseType: 'arraybuffer',
                timeout: 30000, // 30s timeout
                maxRedirects: 0, // Manual redirect handling
                validateStatus: (status) => status >= 200 && status < 400
            });

            if (response.status >= 300 && response.status < 400) {
                const location = response.headers['location'];
                if (!location) {
                    throw new Error('Redirect response missing Location header');
                }

                // Resolve relative URLs
                try {
                    currentUrl = new URL(location, currentUrl).toString();
                } catch (e) {
                    throw new Error(`Invalid redirect location: ${location}`);
                }

                hops++;
                continue;
            }

            // Success (200-299)
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
                    const urlObj = new URL(currentUrl);
                    const pathParts = urlObj.pathname.split('/');
                    const lastPart = pathParts[pathParts.length - 1];
                    if (lastPart && lastPart.length > 0) {
                        filename = lastPart;
                    }
                } catch (e) {
                    // simple split if URL parsing fails
                    const urlParts = currentUrl.split('/');
                    filename = urlParts[urlParts.length - 1].split('?')[0];
                }
            }

            if (!filename) filename = 'downloaded_file';

            return {
                data: Buffer.from(response.data),
                mimeType: contentType,
                filename
            };
        }

        throw new Error('Too many redirects');

    } catch (error) {
        // Enhance error message if it's our security error, otherwise log and rethrow
        if (error instanceof Error && error.message.startsWith('Invalid or unsafe URL')) {
            console.error('Security Block:', error.message);
        } else {
            console.error('Error downloading file from URL:', url, error);
        }
        throw error;
    }
}
