
export function constructRawEmail(to: string, subject: string, body: string): string {
    // Sanitize headers to prevent injection
    const sanitizedTo = to.replace(/[\r\n]+/g, '');
    const sanitizedSubject = subject.replace(/[\r\n]+/g, '');

    const messageParts = [
        `To: ${sanitizedTo}`,
        `Subject: ${sanitizedSubject}`,
        'Content-Type: text/plain; charset="UTF-8"',
        'MIME-Version: 1.0',
        '',
        body
    ];
    return messageParts.join('\n');
}
