import React, { useState } from 'react';
import { Settings, Download, Upload, Moon, Sun, Terminal } from 'lucide-react';

export default function PlatformSettings({ nodes, edges }) {
    const [isOpen, setIsOpen] = useState(false);
    const [apiKey, setApiKey] = useState(localStorage.getItem('OPENAI_API_KEY') || '');

    const handleSave = () => {
        localStorage.setItem('OPENAI_API_KEY', apiKey);
        setIsOpen(false);
    };

    const handleExport = () => {
        const data = {
            meta: {
                version: '1.0.0',
                platform: 'Antigravity Alpha',
                exportedAt: new Date().toISOString(),
            },
            nodes,
            edges,
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `agent-workflow-${Date.now()}.json`;
        a.click();
    };

    return (
        <>
            <div className="absolute top-4 right-4 z-10 flex gap-2">
                <button
                    onClick={handleExport}
                    className="p-2 bg-card border border-border rounded-md shadow-sm hover:bg-accent hover:text-accent-foreground text-muted-foreground transition-colors"
                    title="Export JSON"
                >
                    <Download className="w-5 h-5" />
                </button>
                <button
                    onClick={() => setIsOpen(true)}
                    className="p-2 bg-card border border-border rounded-md shadow-sm hover:bg-accent hover:text-accent-foreground text-muted-foreground transition-colors"
                    title="Platform Settings"
                >
                    <Settings className="w-5 h-5" />
                </button>
            </div>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="w-[500px] bg-card border border-border rounded-xl shadow-2xl p-6 space-y-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between border-b border-border pb-4">
                            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                                <Terminal className="w-5 h-5 text-primary" />
                                System Config
                            </h2>
                            <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
                                ✕
                            </button>
                        </div>

                        <div className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-foreground">Global API Key</label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        placeholder="sk-..."
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                    />
                                </div>
                                <p className="text-[11px] text-muted-foreground">Used for all agents unless overridden by node settings.</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-foreground">Interface Theme</label>
                                <div className="flex gap-2">
                                    <button className="flex-1 flex items-center justify-center gap-2 p-3 border border-border rounded-md bg-accent text-accent-foreground shadow-inner">
                                        <Moon className="w-4 h-4" /> Dark
                                    </button>
                                    <button className="flex-1 flex items-center justify-center gap-2 p-3 border border-border rounded-md bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50" disabled>
                                        <Sun className="w-4 h-4" /> Light
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-border">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground rounded-md transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors shadow-lg shadow-primary/20"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
