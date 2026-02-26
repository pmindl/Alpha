export interface InvoiceMetadata {
    document_type: 'invoice' | 'proforma' | 'credit_note' | 'receipt' | 'false';
    my_company_identifier: 'firma_a' | 'firma_b' | 'unknown';
    provider: string;
    content_type: 'attachment' | 'link' | 'none';
    invoice_url: string | null;
    summary: string;
    relevant_files: string[]; // List of filenames identified as the invoice/receipt
    is_invoice: boolean;
}

export interface AttachmentMetadata {
    id: string;
    filename: string;
    mimeType: string;
    size: number;
}

export interface EmailData {
    id: string;
    threadId: string;
    subject: string;
    sender: string;
    date: string; // ISO string
    body: string; // Plain text or HTML stripped
    snippet: string;
    attachments: AttachmentMetadata[];
}

export interface DriveUploadResult {
    fileId: string;
    webViewLink: string;
    name: string;
    isUpdate?: boolean;
}

export interface DocumentAnalysisResult {
    is_invoice: boolean;
    reason: string;
    document_type: 'invoice' | 'receipt' | 'credit_note' | 'other';
}
