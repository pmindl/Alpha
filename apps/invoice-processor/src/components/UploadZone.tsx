'use client';

import React, { useState, useEffect } from 'react';

interface Company {
    id: string;
    name: string;
}

export function UploadZone({ onUploadComplete }: { onUploadComplete: () => void }) {
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' | null }>({ text: '', type: null });
    const [apiKey, setApiKey] = useState('');
    const [companies, setCompanies] = useState<Company[]>([]);

    useEffect(() => {
        fetch('/processor/api/companies')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setCompanies(data);
            })
            .catch(err => console.error('Failed to fetch companies:', err));
    }, []);

    const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setUploading(true);
        setMessage({ text: '', type: null });

        const form = e.currentTarget;
        const formData = new FormData(form);

        try {
            const res = await fetch('/processor/api/ingest/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                },
                body: formData
            });

            const data = await res.json();
            if (res.ok && data.success) {
                setMessage({ text: 'Faktura byla úspěšně nahrána a zařazena do fronty.', type: 'success' });
                onUploadComplete();
                const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
                if (fileInput) fileInput.value = '';
            } else {
                setMessage({ text: 'Chyba: ' + (data.error || 'Nahrávání selhalo'), type: 'error' });
            }
        } catch (err) {
            setMessage({ text: 'Nahrávání selhalo: ' + (err as Error).message, type: 'error' });
        } finally {
            setUploading(false);
        }
    };

    return (
        <div
            style={{
                marginTop: '1.5rem',
                backgroundColor: 'var(--alpha-card, white)',
                padding: '1.5rem',
                borderRadius: 'var(--alpha-radius, 8px)',
                border: '1px solid var(--alpha-border, #e2e8f0)',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
            }}
        >
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--alpha-foreground, #0f172a)' }}>
                Manuální nahrání faktury
            </h3>
            <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                        type="password"
                        placeholder="API Key (Alpha Master Key)"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        required
                        style={{
                            padding: '0.5rem 0.75rem',
                            borderRadius: '0.375rem',
                            border: '1px solid var(--alpha-border, #e2e8f0)',
                            fontSize: '0.875rem',
                            flex: 1,
                            minWidth: '240px'
                        }}
                    />
                    <select
                        name="company"
                        required
                        style={{
                            padding: '0.5rem 0.75rem',
                            borderRadius: '0.375rem',
                            border: '1px solid var(--alpha-border, #e2e8f0)',
                            backgroundColor: 'white',
                            fontSize: '0.875rem',
                            cursor: 'pointer'
                        }}
                    >
                        {companies.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                        type="file"
                        name="file"
                        required
                        accept="application/pdf,image/*"
                        style={{
                            fontSize: '0.875rem',
                            flex: 1,
                            padding: '0.25rem'
                        }}
                    />
                    <button
                        type="submit"
                        disabled={uploading}
                        style={{
                            padding: '0.5rem 1.25rem',
                            borderRadius: '0.375rem',
                            border: 'none',
                            backgroundColor: 'var(--alpha-primary, #0f172a)',
                            color: 'white',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'opacity 0.2s',
                            opacity: uploading ? 0.7 : 1
                        }}
                    >
                        {uploading ? 'Nahrávám...' : 'Nahrát fakturu'}
                    </button>
                </div>
            </form>
            {message.text && (
                <div
                    style={{
                        marginTop: '1rem',
                        fontSize: '0.875rem',
                        padding: '0.75rem',
                        borderRadius: '0.375rem',
                        backgroundColor: message.type === 'error' ? 'var(--alpha-destructive-fg, #fee2e2)' : 'var(--alpha-muted, #f8fafc)',
                        color: message.type === 'error' ? 'var(--alpha-destructive, #ef4444)' : 'var(--alpha-success, #10b981)',
                        border: `1px solid ${message.type === 'error' ? 'rgba(239, 64, 64, 0.1)' : 'rgba(16, 185, 129, 0.1)'}`
                    }}
                >
                    {message.text}
                </div>
            )}
        </div>
    );
}
