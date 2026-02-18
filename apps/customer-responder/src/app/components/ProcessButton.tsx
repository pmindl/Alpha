'use client';
import { useState } from 'react';

export default function ProcessButton() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleProcess = async () => {
        setLoading(true);
        setResult(null);
        try {
            const res = await fetch('/api/process');
            const data = await res.json();
            setResult(data);
        } catch (error) {
            setResult({ error: 'Failed to process' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center gap-4 p-4 border rounded-xl bg-gray-50 dark:bg-zinc-800/50">
            <button
                onClick={handleProcess}
                disabled={loading}
                className="px-6 py-3 font-semibold text-white bg-blue-600 rounded-lg shadow hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
                {loading ? 'Processing...' : 'Run Analysis & Draft'}
            </button>

            {result && (
                <div className="mt-4 p-4 w-full max-w-md bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 shadow-sm overflow-auto text-sm font-mono">
                    <pre>{JSON.stringify(result, null, 2)}</pre>
                </div>
            )}
        </div>
    );
}
