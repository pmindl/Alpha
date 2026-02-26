import crypto from 'crypto';

export function secureCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

export function sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9.-]/g, '_');
}

export function validateFile(file: File): { valid: boolean; error?: string } {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) return { valid: false, error: 'Invalid file type' };
    if (file.size > 10 * 1024 * 1024) return { valid: false, error: 'File too large' };
    return { valid: true };
}

export function validateFileContent(buffer: Buffer, mimeType: string): { valid: boolean; error?: string } {
    if (!buffer || buffer.length === 0) return { valid: false, error: 'Empty file' };

    const signatures: Record<string, number[]> = {
        'application/pdf': [0x25, 0x50, 0x44, 0x46],
        'image/jpeg': [0xFF, 0xD8, 0xFF],
        'image/png': [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
        'image/webp': [0x52, 0x49, 0x46, 0x46]
    };

    const sig = signatures[mimeType];
    if (!sig) return { valid: false, error: 'Unsupported type' };
    if (buffer.length < Math.max(sig.length, 12)) return { valid: false, error: 'File too small' };

    for (let i = 0; i < sig.length; i++) {
        if (buffer[i] !== sig[i]) return { valid: false, error: 'Magic bytes mismatch' };
    }

    if (mimeType === 'image/webp') {
        const webpSig = [0x57, 0x45, 0x42, 0x50]; // WEBP
        for (let i = 0; i < webpSig.length; i++) {
            if (buffer[8 + i] !== webpSig[i]) return { valid: false, error: 'WebP mismatch' };
        }
    }

    return { valid: true };
}
