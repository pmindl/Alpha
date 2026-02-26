'use client';

import { useState } from 'react';

export function UploadZone({ onUploadComplete }: { onUploadComplete: () => void }) {
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState('');
    const [apiKey, setApiKey] = useState('');

    const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setUploading(true);
        setMessage('');

        const form = e.currentTarget;
        const formData = new FormData(form);

        try {
            const res = await fetch('/api/ingest/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                },
                body: formData
            });

            const data = await res.json();
            if (res.ok && data.success) {
                setMessage('Upload successful!');
                onUploadComplete();
                // Clear file input only
                const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
                if (fileInput) fileInput.value = '';
            } else {
                setMessage('Error: ' + (data.error || 'Upload failed'));
            }
        } catch (err) {
            setMessage('Upload failed: ' + (err as Error).message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="card" style={{ marginTop: '2rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Manual Upload</h3>
            <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                        type="password"
                        placeholder="API Key"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        required
                        className="btn"
                        style={{ background: 'var(--bg-surface)', flex: 1, minWidth: '200px' }}
                    />
                    <select name="company" className="btn" style={{ background: 'var(--bg-surface)' }}>
                        <option value="firma_a">Lumegro (Firma A)</option>
                        <option value="firma_b">Lumenica (Firma B)</option>
                    </select>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input type="file" name="file" required className="btn" style={{ flex: 1 }} />
                    <button type="submit" className="btn btn-primary" disabled={uploading}>
                        {uploading ? 'Uploading...' : 'Upload'}
                    </button>
                </div>
            </form>
            {message && <div style={{ marginTop: '1rem', color: message.includes('Error') ? 'var(--error)' : 'var(--success)' }}>{message}</div>}
        </div>
    );
}
