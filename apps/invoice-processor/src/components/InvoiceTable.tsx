'use client';

import React from 'react';
import Link from 'next/link';
import { StatusBadge } from './StatusBadge';

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
        return (
            <div
                style={{
                    padding: '3rem',
                    textAlign: 'center',
                    color: 'var(--alpha-muted-fg, #64748b)',
                    backgroundColor: 'var(--alpha-background, white)',
                    borderRadius: 'var(--alpha-radius, 8px)',
                    border: '1px dashed var(--alpha-border, #e2e8f0)',
                    fontSize: '0.875rem'
                }}
            >
                Žádné faktury k zobrazení.
            </div>
        );
    }

    return (
        <div style={{ overflowX: 'auto', border: '1px solid var(--alpha-border, #e2e8f0)', borderRadius: 'var(--alpha-radius, 8px)', backgroundColor: 'var(--alpha-card, white)' }}>
            <table
                style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    textAlign: 'left',
                    fontSize: '0.875rem',
                }}
            >
                <thead style={{ backgroundColor: 'var(--alpha-muted, #f8fafc)', borderBottom: '1px solid var(--alpha-border, #e2e8f0)' }}>
                    <tr>
                        <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--alpha-muted-fg, #64748b)' }}>Stav</th>
                        <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--alpha-muted-fg, #64748b)' }}>Firma</th>
                        <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--alpha-muted-fg, #64748b)' }}>Dodavatel</th>
                        <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--alpha-muted-fg, #64748b)' }}>Číslo / VS</th>
                        <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--alpha-muted-fg, #64748b)' }}>Částka</th>
                        <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--alpha-muted-fg, #64748b)' }}>Datum</th>
                        <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--alpha-muted-fg, #64748b)' }}>Vytvořeno</th>
                    </tr>
                </thead>
                <tbody style={{ borderTop: '0' }}>
                    {invoices.map((inv) => (
                        <tr
                            key={inv.id}
                            style={{
                                borderBottom: '1px solid var(--alpha-border, #e2e8f0)',
                                transition: 'background-color 0.2s',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--alpha-muted, #f8fafc)')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                            <td style={{ padding: '0.75rem 1rem' }}>
                                <StatusBadge status={inv.status} />
                                {inv.errorMessage && (
                                    <div
                                        title={inv.errorMessage}
                                        style={{
                                            fontSize: '0.625rem',
                                            color: 'var(--alpha-destructive, #ef4444)',
                                            marginTop: '0.25rem',
                                            maxWidth: '120px',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        {inv.errorMessage}
                                    </div>
                                )}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', color: 'var(--alpha-foreground, #0f172a)' }}>
                                {inv.company === 'firma_a' ? 'Lumegro' : inv.company === 'firma_b' ? 'Lumenica' : inv.company}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 500, color: 'var(--alpha-foreground, #0f172a)' }}>
                                <Link href={`/invoices/${inv.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                                    {inv.supplierName}
                                </Link>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', color: 'var(--alpha-muted-fg, #64748b)' }}>
                                {inv.invoiceNumber}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--alpha-foreground, #0f172a)' }}>
                                {(() => {
                                    const currencyMap: Record<string, string> = {
                                        'Kč': 'CZK',
                                        'CZK': 'CZK',
                                        'EUR': 'EUR',
                                        'USD': 'USD'
                                    };
                                    const code = currencyMap[inv.currency] || 'CZK';
                                    try {
                                        return new Intl.NumberFormat('cs-CZ', {
                                            style: 'currency',
                                            currency: code,
                                            minimumFractionDigits: 0
                                        }).format(inv.total);
                                    } catch (e) {
                                        return `${inv.total} ${inv.currency}`;
                                    }
                                })()}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', color: 'var(--alpha-muted-fg, #64748b)' }}>
                                {inv.dateIssued || '—'}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', color: 'var(--alpha-muted-fg, #64748b)', fontSize: '0.75rem' }}>
                                {new Date(inv.createdAt).toLocaleString('cs-CZ', {
                                    day: 'numeric',
                                    month: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
