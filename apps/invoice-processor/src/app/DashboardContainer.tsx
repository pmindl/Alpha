'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DashboardHeader } from '../components/Dashboard';
import { InvoiceTable } from '../components/InvoiceTable';
import { UploadZone } from '../components/UploadZone';

export default function DashboardContainer() {
    const [invoices, setInvoices] = useState([]);
    const [stats, setStats] = useState({ total: 0, exported: 0, pending: 0, errors: 0 });
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [invRes, statsRes] = await Promise.all([
                fetch('/processor/api/invoices'),
                fetch('/processor/api/stats')
            ]);

            if (invRes.ok) {
                const data = await invRes.json();
                setInvoices(data);
            }

            if (statsRes.ok) {
                const data = await statsRes.json();
                setStats(data.summary);
            }
        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleProcess = async () => {
        await fetch('/processor/api/trigger?action=process', { method: 'POST' });
    };

    const handleExport = async () => {
        await fetch('/processor/api/trigger?action=export', { method: 'POST' });
    };

    return (
        <main className="container">
            <DashboardHeader
                stats={stats}
                onRefresh={fetchData}
                onProcess={handleProcess}
                onExport={handleExport}
            />

            <UploadZone onUploadComplete={fetchData} />

            <div style={{ marginTop: '2.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--alpha-foreground, #0f172a)' }}>
                        Poslední faktury
                    </h2>
                    {loading && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--alpha-muted-fg, #64748b)' }}>
                            Načítám...
                        </span>
                    )}
                </div>
                <InvoiceTable invoices={invoices} />
            </div>
        </main>
    );
}
