'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { StatusBadge } from '@/components/StatusBadge';

export default function InvoiceDetail() {
    const params = useParams();
    const router = useRouter();
    const [invoice, setInvoice] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!params.id) return;
        fetch(`/processor/api/invoices/${params.id}`)
            .then(async (res) => {
                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.error || 'Failed to fetch invoice');
                }
                return data;
            })
            .then(data => {
                setInvoice(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to fetch invoice:', err);
                setInvoice({ error: err.message });
                setLoading(false);
            });
    }, [params.id]);

    if (loading) return <div className="container" style={{ padding: '2rem' }}>Načítám detail faktury...</div>;
    if (!invoice || invoice.error) return <div className="container" style={{ padding: '2rem', color: 'var(--alpha-destructive)' }}>Faktura nebyla nalezena nebo se vyskytla chyba: {invoice?.error}</div>;

    return (
        <main className="container">
            <div style={{ marginBottom: '2rem' }}>
                <button
                    onClick={() => router.back()}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--alpha-muted-fg)',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '1rem'
                    }}
                >
                    ← Zpět na seznam
                </button>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Detail faktury {invoice.invoiceNumber}</h1>
                        <p style={{ color: 'var(--alpha-muted-fg)' }}>ID: {invoice.id}</p>
                    </div>
                    <StatusBadge status={invoice.status} />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                {/* Left Column: Data */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <section style={{ backgroundColor: 'var(--alpha-card)', padding: '1.5rem', borderRadius: 'var(--alpha-radius)', border: '1px solid var(--alpha-border)' }}>
                        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Extrahovaná data</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.875rem' }}>
                            <div>
                                <label style={{ color: 'var(--alpha-muted-fg)', display: 'block' }}>Dodavatel</label>
                                <span style={{ fontWeight: 500 }}>{invoice.supplierName}</span>
                            </div>
                            <div>
                                <label style={{ color: 'var(--alpha-muted-fg)', display: 'block' }}>IČO / DIČ</label>
                                <span>{invoice.supplierIco || '—'} / {invoice.supplierDic || '—'}</span>
                            </div>
                            <div>
                                <label style={{ color: 'var(--alpha-muted-fg)', display: 'block' }}>Firma (kupující)</label>
                                <span>{invoice.company}</span>
                            </div>
                            <div>
                                <label style={{ color: 'var(--alpha-muted-fg)', display: 'block' }}>Částka</label>
                                <span style={{ fontWeight: 600 }}>{invoice.total.toLocaleString()} {invoice.currency}</span>
                            </div>
                            <div>
                                <label style={{ color: 'var(--alpha-muted-fg)', display: 'block' }}>VS / Číslo</label>
                                <span>{invoice.variableSymbol || invoice.invoiceNumber}</span>
                            </div>
                            <div>
                                <label style={{ color: 'var(--alpha-muted-fg)', display: 'block' }}>Datum vystavení</label>
                                <span>{invoice.dateIssued || '—'}</span>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Right Column: Logs */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <section style={{ backgroundColor: 'var(--alpha-card)', padding: '1.5rem', borderRadius: 'var(--alpha-radius)', border: '1px solid var(--alpha-border)' }}>
                        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Historie zpracování</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {invoice.logs?.map((log: any) => (
                                <div key={log.id} style={{ fontSize: '0.75rem', padding: '0.5rem', borderRadius: '0.25rem', backgroundColor: 'var(--alpha-muted)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--alpha-muted-fg)', marginBottom: '0.25rem' }}>
                                        <span>{log.source} • {log.level}</span>
                                        <span>{new Date(log.timestamp).toLocaleString()}</span>
                                    </div>
                                    <div style={{ fontWeight: 500 }}>{log.message}</div>
                                    {log.details && (
                                        <pre style={{ fontSize: '0.625rem', marginTop: '0.25rem', opacity: 0.7, overflow: 'auto' }}>
                                            {log.details}
                                        </pre>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}
