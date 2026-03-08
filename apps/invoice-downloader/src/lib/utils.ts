
/**
 * Escapes a string for use in a Google Drive API query.
 * Google Drive queries use single quotes for string literals.
 * We must escape single quotes as \' and backslashes as \\.
 */
export function escapeDriveQueryString(str: string): string {
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Sanitizes a filename by removing dangerous characters.
 */
export function sanitizeFilename(filename: string): string {
    // Remove null bytes, control characters, and dangerous punctuation
    // Keep dots, dashes, underscores, and Alphanum
    return filename
        .replace(/[\u0000-\u001f\u007f-\u009f]/g, '') // Remove control characters
        .replace(/[<>:"/\\|?*]/g, '_')               // Replace OS-prohibited characters with underscore
        .replace(/^\.+/, '')                         // Remove leading dots (hidden files)
        .trim();
}
