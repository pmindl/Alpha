'use client';

import React from 'react';

interface MetricCardProps {
    title: string;
    value: number | string;
    subtitle?: string;
    trend?: 'up' | 'down' | 'neutral';
    color?: string;
}

export function MetricCard({ title, value, subtitle, trend, color }: MetricCardProps) {
    return (
        <div
            style={{
                backgroundColor: 'var(--alpha-card, white)',
                padding: '1.25rem',
                borderRadius: 'var(--alpha-radius, 8px)',
                border: '1px solid var(--alpha-border, #e2e8f0)',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                flex: 1,
            }}
        >
            <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--alpha-muted-fg, #64748b)' }}>
                {title}
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: color || 'var(--alpha-foreground, #0f172a)' }}>
                {value}
            </div>
            {subtitle && (
                <div style={{ fontSize: '0.75rem', color: 'var(--alpha-muted-fg, #64748b)' }}>
                    {subtitle}
                </div>
            )}
        </div>
    );
}
