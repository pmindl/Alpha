import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadPacketaInvoices } from '../packeta';
import axios from 'axios';
import * as gdrive from '../gdrive';

vi.mock('googleapis', () => ({
    google: {
        drive: vi.fn(),
        auth: {
            OAuth2: vi.fn()
        }
    }
}));
vi.mock('@alpha/google-auth', () => ({
    getGoogleAuth: vi.fn()
}));
vi.mock('axios', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn()
    }
}));
vi.mock('../gdrive');
vi.mock('../companies', () => ({
    getCompanies: () => [
        { id: 'firma_a', name: 'Firma A', emailPatterns: ['zasilkovna'], gdriveFolderId: 'folder_a' }
    ]
}));

describe('Packeta Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.PACKETA_API_KEY = 'test_key';
        process.env.PACKETA_API_PASSWORD = 'test_password';
    });

    it('should download invoices and upload to GDrive', async () => {
        const mockCsv = "Mena;Datum vystaveni;Datum splatnosti;Cislo faktury;Uctovane sluzby\nCZK;2024-03-01;2024-03-15;191245944;123.45";

        (axios.get as any).mockImplementation((url: string) => {
            if (url.endsWith('invoice.csv')) {
                return Promise.resolve({ data: mockCsv, status: 200 });
            }
            if (url.endsWith('invoice.pdf')) {
                return Promise.resolve({ data: Buffer.from('pdf_content'), status: 200 });
            }
        });

        (gdrive.listFiles as any).mockResolvedValue([]);
        (gdrive.uploadFile as any).mockResolvedValue({ fileId: 'new_id', webViewLink: 'link' });

        const results = await downloadPacketaInvoices();

        expect(results).toHaveLength(1);
        expect(results[0].invoice).toBe('191245944');
        expect(gdrive.uploadFile).toHaveBeenCalledWith(
            'Packeta_191245944.pdf',
            'application/pdf',
            expect.any(Buffer),
            'folder_a'
        );
    });

    it('should skip already existing invoices', async () => {
        const mockCsv = "Mena;Datum vystaveni;Datum splatnosti;Cislo faktury;Uctovane sluzby\nCZK;2024-03-01;2024-03-15;191245944;123.45";

        (axios.get as any).mockResolvedValue({ data: mockCsv, status: 200 });
        (gdrive.listFiles as any).mockResolvedValue([{ name: 'Packeta_191245944.pdf' }]);

        const results = await downloadPacketaInvoices();

        expect(results).toHaveLength(0);
        expect(gdrive.uploadFile).not.toHaveBeenCalled();
    });

    it('should isolate errors for individual PDF downloads', async () => {
        const mockCsv = "Mena;Datum vystaveni;Datum splatnosti;Cislo faktury;Uctovane sluzby\nCZK;2024-03-01;2024-03-15;100000001;xxx\nCZK;2024-03-01;2024-03-15;100000002;yyy";

        (axios.get as any).mockImplementation((url: string, config: any) => {
            if (url.endsWith('invoice.csv')) return Promise.resolve({ data: mockCsv, status: 200 });

            const num = config?.params?.number;
            if (num === '100000001') return Promise.reject({ response: { status: 404 }, message: 'Not Found' });
            if (num === '100000002') return Promise.resolve({ data: Buffer.from('ok'), status: 200 });
            return Promise.reject(new Error('Unexpected URL'));
        });

        (gdrive.listFiles as any).mockResolvedValue([]);
        (gdrive.uploadFile as any).mockResolvedValue({ fileId: 'id', webViewLink: 'l' });

        const results = await downloadPacketaInvoices();

        expect(results).toHaveLength(1); // 100000001 failed, 100000002 succeeded
        expect(results[0].invoice).toBe('100000002');
    });
});
