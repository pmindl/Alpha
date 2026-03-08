'use client';

import React, { useState, useEffect } from 'react';
import { MetricCard } from './MetricCard';

interface Stats {
    total: number;
    exported: number;
    pending: number;
    errors: number;
}

export function DashboardHeader({ stats, onRefresh, onProcess, onExport }: {
    stats: Stats,
    onRefresh: () => void,
    onProcess: () => void,
    onExport: () => void
}) {
    const [loading, setLoading] = useState<string | null>(null);

    const handleAction = async (name: string, fn: () => Promise<void>) => {
        setLoading(name);
        try {
            await fn();
            onRefresh();
        } catch (error) {
            console.error(`Action ${name} failed:`, error);
        } finally {
            setLoading(null);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--alpha-foreground, #0f172a)' }}>
                        Invoice Mission Control
                    </h1>
                    <p style={{ fontSize: '0.875rem', color: 'var(--alpha-muted-fg, #64748b)' }}>
                        Správa a monitoring automatického zpracování faktur
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                        onClick={() => onRefresh()}
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '0.375rem',
                            border: '1px solid var(--alpha-border, #e2e8f0)',
                            backgroundColor: 'transparent',
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            transition: 'background-color 0.2s'
                        }}
                    >
                        ↻ Obnovit
                    </button>
                    <button
                        onClick={() => handleAction('process', async () => onProcess())}
                        disabled={!!loading}
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '0.375rem',
                            border: 'none',
                            backgroundColor: 'var(--alpha-primary, #0f172a)',
                            color: 'white',
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                            opacity: loading === 'process' ? 0.7 : 1,
                            transition: 'opacity 0.2s'
                        }}
                    >
                        {loading === 'process' ? 'Zpracovávám...' : 'Skenovat GDrive'}
                    </button>
                    <button
                        onClick={() => handleAction('export', async () => onExport())}
                        disabled={!!loading || stats.pending === 0}
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '0.375rem',
                            border: 'none',
                            backgroundColor: 'var(--alpha-secondary, #f1f5f9)',
                            color: 'var(--alpha-secondary-fg, #0f172a)',
                            fontSize: '0.875rem',
                            cursor: stats.pending === 0 ? 'not-allowed' : 'pointer',
                            opacity: (loading === 'export' || stats.pending === 0) ? 0.7 : 1,
                            transition: 'opacity 0.2s'
                        }}
                    >
                        {loading === 'export' ? 'Exportuji...' : `Exportovat čekající (${stats.pending})`}
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <MetricCard
                    title="Celkem zpracováno"
                    value={stats.total}
                    subtitle="Všechny faktury v DB"
                />
                <MetricCard
                    title="Exportováno"
                    value={stats.exported}
                    color="var(--alpha-success, #10b981)"
                    subtitle="Úspěšně v SuperFaktuře"
                />
                <MetricCard
                    title="Čeká na export"
                    value={stats.pending}
                    color="var(--alpha-warning, #f59e0b)"
                    subtitle="Připraveno k odeslání"
                />
                <MetricCard
                    title="Chyby"
                    value={stats.errors}
                    color="var(--alpha-destructive, #ef4444)"
                    subtitle="Vyžaduje pozornost"
                />
            </div>
        </div>
    );
}
