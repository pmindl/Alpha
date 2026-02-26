
/**
 * Escapes a string for use in a Google Drive API query.
 * Google Drive queries use single quotes for string literals.
 * We must escape single quotes as \' and backslashes as \\.
 */
export function escapeDriveQueryString(str: string): string {
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
