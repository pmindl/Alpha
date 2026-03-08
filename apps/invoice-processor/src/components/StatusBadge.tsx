'use client';

import React from 'react';

type Status = 'PENDING' | 'EXPORTED' | 'EXPORT_ERROR' | 'SKIPPED' | 'DUPLICATE' | 'PROCESSING';

const statusMap: Record<Status, { label: string; color: string; bg: string }> = {
    PENDING: { label: 'Čeká', color: '#f59e0b', bg: '#fef3c7' }, // Amber
    EXPORTED: { label: 'Exportováno', color: '#10b981', bg: '#d1fae5' }, // Emerald
    EXPORT_ERROR: { label: 'Chyba', color: '#ef4444', bg: '#fee2e2' }, // Red
    SKIPPED: { label: 'Přeskočeno', color: '#6b7280', bg: '#f3f4f6' }, // Gray
    DUPLICATE: { label: 'Duplicita', color: '#3b82f6', bg: '#dbeafe' }, // Blue
    PROCESSING: { label: 'Zpracovává se', color: '#8b5cf6', bg: '#ede9fe' }, // Violet
};

export function StatusBadge({ status }: { status: string }) {
    const config = statusMap[status as Status] || { label: status, color: '#6b7280', bg: '#f3f4f6' };

    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0.125rem 0.625rem',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: config.color,
                backgroundColor: config.bg,
                border: `1px solid ${config.color}20`,
                textTransform: 'uppercase',
                letterSpacing: '0.025em',
            }}
        >
            {config.label}
        </span>
    );
}
