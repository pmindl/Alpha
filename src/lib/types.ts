import { Invoice } from '@prisma/client';

export type InvoiceStatus = 'PENDING' | 'EXPORTED' | 'EXPORT_ERROR' | 'SKIPPED' | 'DUPLICATE';
export type InvoiceSource = 'EMAIL' | 'URL' | 'UPLOAD' | 'GDRIVE';

export interface CompanyConfig {
    id: string; // firma_a
    name: string;
    ico: string;
    gdriveFolderId: string;
    sfClientId: string;
    emailPatterns: string[];
}

export interface ParsedInvoice {
    is_invoice: boolean;
    confidence: number;
    my_company_identifier: string;
    supplier: {
        name: string;
        ico: string;
        dic: string;
        address?: string;
    };
    buyer: {
        name: string;
        ico: string;
        dic: string;
    };
    invoice: {
        number: string;
        variable_symbol: string;
        date_issued: string;
        date_due: string;
        currency: string;
    };
    items: Array<{
        name: string;
        quantity: number;
        unit_price: number;
        vat_rate: number;
    }>;
    totals: {
        subtotal: number;
        vat: number;
        total: number;
    };
}
