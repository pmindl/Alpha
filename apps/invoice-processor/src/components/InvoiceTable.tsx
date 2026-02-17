'use client';



interface Invoice {
    id: string;
    status: string;
    company: string;
    supplierName: string;
    invoiceNumber: string;
    total: number;
    currency: string;
    dateIssued: string | null;
    createdAt: string;
    errorMessage: string | null;
}

export function InvoiceTable({ invoices }: { invoices: Invoice[] }) {
    if (invoices.length === 0) {
        return <div className="p-8 text-center text-gray-500">No invoices found.</div>;
    }

    return (
        <table className="invoice-table">
            <thead>
                <tr>
                    <th>Status</th>
                    <th>Company</th>
                    <th>Supplier</th>
                    <th>Number</th>
                    <th>Total</th>
                    <th>Date</th>
                    <th>Created</th>
                </tr>
            </thead>
            <tbody>
                {invoices.map((inv) => (
                    <tr key={inv.id}>
                        <td>
                            <span className={`badge badge-${inv.status}`}>
                                {inv.status}
                            </span>
                            {inv.errorMessage && (
                                <div style={{ fontSize: '0.7rem', color: 'var(--error)', marginTop: '0.2rem' }}>
                                    {inv.errorMessage}
                                </div>
                            )}
                        </td>
                        <td>{inv.company}</td>
                        <td>{inv.supplierName}</td>
                        <td className="mono">{inv.invoiceNumber}</td>
                        <td className="mono">
                            {new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: inv.currency }).format(inv.total)}
                        </td>
                        <td>{inv.dateIssued}</td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                            {new Date(inv.createdAt).toLocaleString()}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
