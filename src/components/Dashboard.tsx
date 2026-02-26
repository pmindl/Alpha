'use client';

import { useState } from 'react';

interface StatsProps {
    total: number;
    exported: number;
    pending: number;
    errors: number;
}

export function StatsCards({ stats }: { stats: StatsProps }) {
    return (
        <div className="stats-grid">
            <div className="card">
                <div className="stat-value">{stats.total}</div>
                <div className="stat-label">Total processed</div>
            </div>
            <div className="card">
                <div className="stat-value" style={{ color: 'var(--success)' }}>{stats.exported}</div>
                <div className="stat-label">Exported</div>
            </div>
            <div className="card">
                <div className="stat-value" style={{ color: 'var(--warning)' }}>{stats.pending}</div>
                <div className="stat-label">Pending export</div>
            </div>
            <div className="card">
                <div className="stat-value" style={{ color: 'var(--error)' }}>{stats.errors}</div>
                <div className="stat-label">Errors</div>
            </div>
        </div>
    );
}

export function ActionBar({ onRefresh, onProcess, onExport }: {
    onRefresh: () => void,
    onProcess: () => void,
    onExport: () => void
}) {
    const [loading, setLoading] = useState('');

    const handle = async (name: string, fn: () => Promise<void>) => {
        setLoading(name);
        await fn();
        setLoading('');
        onRefresh();
    };

    return (
        <div className="action-bar">
            <button className="btn" onClick={() => handle('refresh', async () => onRefresh())} disabled={!!loading}>
                {loading === 'refresh' ? 'Loading...' : '↻ Refresh Data'}
            </button>
            <button className="btn btn-primary" onClick={() => handle('process', async () => onProcess())} disabled={!!loading}>
                {loading === 'process' ? 'Processing...' : '▶ Process New Files'}
            </button>
            <button className="btn" onClick={() => handle('export', async () => onExport())} disabled={!!loading}>
                {loading === 'export' ? 'Exporting...' : '▶ Export Pending'}
            </button>
        </div>
    );
}
