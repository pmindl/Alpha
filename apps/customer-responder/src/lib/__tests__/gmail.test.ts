import { describe, it, expect } from 'vitest';
import { constructRawEmail } from '../email-utils';

describe('constructRawEmail', () => {
    it('should construct a valid raw email with valid inputs', () => {
        const to = 'test@example.com';
        const subject = 'Test Subject';
        const body = 'This is the body.';

        const rawEmail = constructRawEmail(to, subject, body);

        expect(rawEmail).toContain(`To: ${to}`);
        expect(rawEmail).toContain(`Subject: ${subject}`);
        expect(rawEmail).toContain(body);
        expect(rawEmail).toContain('Content-Type: text/plain; charset="UTF-8"');
    });

    it('should sanitize newlines in "to" field to prevent header injection', () => {
        const to = 'test@example.com\nCc: attacker@example.com';
        const subject = 'Test Subject';
        const body = 'Body';

        const rawEmail = constructRawEmail(to, subject, body);

        // Expect newline to be removed
        expect(rawEmail).toContain('To: test@example.comCc: attacker@example.com');
        // Ensure injection didn't happen (it would be on a new line if it did)
        expect(rawEmail).not.toMatch(/^Cc: attacker@example.com/m);
    });

    it('should sanitize newlines in "subject" field to prevent header injection', () => {
        const to = 'test@example.com';
        const subject = 'Hello\nBcc: attacker@example.com';
        const body = 'Body';

        const rawEmail = constructRawEmail(to, subject, body);

        // Expect newline to be removed
        expect(rawEmail).toContain('Subject: HelloBcc: attacker@example.com');
        // Ensure injection didn't happen
        expect(rawEmail).not.toMatch(/^Bcc: attacker@example.com/m);
    });

    it('should sanitize carriage returns as well', () => {
        const to = 'test@example.com';
        const subject = 'Hello\rBcc: attacker@example.com';
        const body = 'Body';

        const rawEmail = constructRawEmail(to, subject, body);

        expect(rawEmail).toContain('Subject: HelloBcc: attacker@example.com');
    });
});
