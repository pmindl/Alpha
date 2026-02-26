
/**
 * Safely logs errors without exposing sensitive information like request headers or configuration.
 * Specifically handles Axios errors to extract only safe response details.
 */
export function logErrorSafely(context: string, error: unknown) {
    let errorMessage = 'Unknown error';
    let errorDetails: any = null;

    if (error instanceof Error) {
        errorMessage = error.message;

        // Check for Axios error structure without explicit dependency
        // Axios errors have 'response' and 'config' properties
        const e = error as any;
        if (e.response) {
            errorDetails = {
                status: e.response.status,
                statusText: e.response.statusText,
                data: e.response.data
            };
        } else if (e.code) {
            // Log error code (e.g., ECONNREFUSED)
            errorDetails = { code: e.code };
        }
    } else if (typeof error === 'string') {
        errorMessage = error;
    } else {
        errorMessage = String(error);
    }

    // Format: ❌ [Context]: [Message] {Details JSON}
    // Only log details if present
    const detailsStr = errorDetails ? ` Details: ${JSON.stringify(errorDetails)}` : '';
    console.error(`❌ ${context}: ${errorMessage}${detailsStr}`);
}
