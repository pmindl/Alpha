
import { describe, it, expect } from 'vitest';
import { constructRawEmail } from '../email-utils';

describe('constructRawEmail', () => {
    it('should construct a valid email', () => {
        const raw = constructRawEmail('test@example.com', 'Hello', 'Body content');
        expect(raw).toContain('To: test@example.com');
        expect(raw).toContain('Subject: Hello');
        expect(raw).toContain('Body content');
    });

    it('should sanitize "to" header by removing newlines', () => {
        const maliciousTo = 'victim@example.com\nCc: attacker@example.com';
        const raw = constructRawEmail(maliciousTo, 'Subject', 'Body');

        // Should not have a newline before Cc:
        expect(raw).not.toMatch(/To: .*[\r\n]+Cc:/);
        // "Cc:" should not be at the start of a line (except if it was the first header, which it isn't)
        const lines = raw.split('\n');
        const ccLine = lines.find(line => line.startsWith('Cc:'));
        expect(ccLine).toBeUndefined();

        // It should be concatenated
        expect(raw).toContain('To: victim@example.comCc: attacker@example.com');
    });

    it('should sanitize "subject" header by replacing newlines with space', () => {
        const maliciousSubject = 'Hello\nSubject: HACKED';
        const raw = constructRawEmail('test@example.com', maliciousSubject, 'Body');

        // Should not have a newline in subject line
        expect(raw).not.toMatch(/Subject: Hello[\r\n]+Subject:/);

        // Should have removed the newline (concatenated)
        expect(raw).toContain('Subject: HelloSubject: HACKED');
    });
});
