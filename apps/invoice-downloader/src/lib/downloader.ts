import axios from 'axios';
import { validateAndResolvePublicIp } from './ssrf';

export async function downloadFile(url: string): Promise<{ data: Buffer, mimeType: string, filename: string | null }> {
    let currentUrl = url;
    let hops = 0;
    const maxHops = 5;

    try {
        while (hops < maxHops) {
            const urlObj = new URL(currentUrl);
            const originalHostname = urlObj.hostname;

            // Resolve and validate IP (prevent SSRF and DNS Rebinding)
            const validatedIp = await validateAndResolvePublicIp(originalHostname);
            if (!validatedIp) {
                throw new Error(`Invalid or unsafe URL: ${currentUrl}`);
            }

            // Pin the IP in the URL to prevent re-resolution
            // But we must keep the original Host header for many servers (especially CDNs/reverse proxies)
            urlObj.hostname = validatedIp;

            const response = await axios.get(urlObj.toString(), {
                headers: {
                    'Host': originalHostname
                },
                responseType: 'arraybuffer',
                timeout: 30000,
                maxRedirects: 0,
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
                    const pathParts = new URL(currentUrl).pathname.split('/');
                    const lastPart = pathParts[pathParts.length - 1];
                    if (lastPart && lastPart.length > 0) {
                        filename = lastPart;
                    }
                } catch (e) {
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

    } catch (error: any) {
        if (error.message?.startsWith('Invalid or unsafe URL')) {
            console.error('Security Block:', error.message);
        } else {
            console.error('Error downloading file from URL:', url, error.message);
        }
        throw error;
    }
}
