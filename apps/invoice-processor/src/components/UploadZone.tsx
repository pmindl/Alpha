'use client';

import { useState } from 'react';

export function UploadZone({ onUploadComplete }: { onUploadComplete: () => void }) {
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState('');

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Default to first company or ask user. 
        // For MVP, simplify: upload to configurable default or Company A?
        // Let's assume we want to select company.
        // UI needs Select. For now hardcode 'firma_a' or add select.
        // Let's add a simple select.

        // Changing approach: Don't auto-upload on change. Show selected file and "Upload" button.
    };

    const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setUploading(true);
        setMessage('');

        const formData = new FormData(e.currentTarget);

        // Add API Key for auth? 
        // Secure way: Proxy route.
        // Let's implement /api/trigger/upload proxy? No, too complex.
        // Let's just use the proxy approach again or rely on basic unprotected route for local tool?
        // Let's use a proxy route /api/upload-proxy

        try {
            const res = await fetch('/api/upload-proxy', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();
            if (data.success) {
                setMessage('Upload successful!');
                onUploadComplete();
                (e.target as HTMLFormElement).reset();
            } else {
                setMessage('Error: ' + data.error);
            }
        } catch (err) {
            setMessage('Upload failed');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="card" style={{ marginTop: '2rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Manual Upload</h3>
            <form onSubmit={handleUpload} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <input type="file" name="file" required className="btn" />
                <select name="company" className="btn" style={{ background: 'var(--bg-surface)' }}>
                    <option value="firma_a">Lumegro (Firma A)</option>
                    <option value="firma_b">Lumenica (Firma B)</option>
                </select>
                <button type="submit" className="btn btn-primary" disabled={uploading}>
                    {uploading ? 'Uploading...' : 'Upload'}
                </button>
            </form>
            {message && <div style={{ marginTop: '1rem', color: message.includes('Error') ? 'var(--error)' : 'var(--success)' }}>{message}</div>}
        </div>
    );
}
