"use client";

import { useEffect, useState } from "react";
import { Button } from "@alpha/ui";
import Link from "next/link";

interface ContextItem {
    id: string;
    name: string;
    content: string;
    scopes: string[];
    updatedAt?: string;
}

export default function ContextPage() {
    const [contexts, setContexts] = useState<ContextItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Form state
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        id: "",
        name: "",
        content: "",
        scopes: "global"
    });

    const fetchContexts = () => {
        setLoading(true);
        fetch('/api/context')
            .then(res => res.json())
            .then(data => {
                setContexts(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchContexts();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const scopesArray = formData.scopes.split(',').map(s => s.trim());

        const res = await fetch('/api/context', {
            method: 'POST',
            body: JSON.stringify({
                ...formData,
                scopes: scopesArray
            })
        });

        if (res.ok) {
            setFormData({ id: "", name: "", content: "", scopes: "global" });
            setIsEditing(false);
            fetchContexts();
        } else {
            alert("Failed to save context");
        }
    };

    const handleEdit = (item: ContextItem) => {
        setFormData({
            id: item.id,
            name: item.name,
            content: item.content,
            scopes: item.scopes.join(', ')
        });
        setIsEditing(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm(`Delete context ${id}?`)) return;

        const res = await fetch(`/api/context?id=${id}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            fetchContexts();
        } else {
            alert("Failed to delete context");
        }
    };

    const handleCancel = () => {
        setFormData({ id: "", name: "", content: "", scopes: "global" });
        setIsEditing(false);
    };

    return (
        <div className="min-h-screen p-8 pb-20 sm:p-20 font-[family-name:var(--font-geist-sans)]">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold">Context Management</h1>
                    <Link href="/">
                        <Button variant="outline">Back to Dashboard</Button>
                    </Link>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* List Column */}
                    <div className="lg:col-span-1 bg-white dark:bg-zinc-900 border rounded-lg p-4 h-fit">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="font-semibold">Contexts</h2>
                            <Button size="sm" onClick={() => { setIsEditing(true); setFormData({ id: "", name: "", content: "", scopes: "global" }); }}>
                                + New
                            </Button>
                        </div>
                        <div className="flex flex-col gap-2">
                            {loading && <p className="text-sm text-gray-500">Loading...</p>}
                            {!loading && contexts.length === 0 && <p className="text-sm text-gray-500">No contexts found</p>}
                            {contexts.map(ctx => (
                                <div
                                    key={ctx.id}
                                    className={`p-3 border rounded cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 ${formData.id === ctx.id && isEditing ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''}`}
                                    onClick={() => handleEdit(ctx)}
                                >
                                    <div className="font-medium">{ctx.name}</div>
                                    <div className="text-xs text-gray-500 font-mono">{ctx.id}</div>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                        {ctx.scopes.map(s => (
                                            <span key={s} className="text-[10px] bg-gray-100 dark:bg-zinc-800 px-1 rounded">
                                                {s}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Editor Column */}
                    <div className="lg:col-span-2">
                        {isEditing ? (
                            <div className="bg-white dark:bg-zinc-900 border rounded-lg p-6">
                                <h2 className="text-xl font-semibold mb-4">{formData.id && contexts.find(c => c.id === formData.id) ? 'Edit Context' : 'New Context'}</h2>
                                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">ID (Unique)</label>
                                            <input
                                                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
                                                value={formData.id}
                                                onChange={e => setFormData({ ...formData, id: e.target.value })}
                                                placeholder="invoice-extraction-rules"
                                                required
                                                disabled={!!contexts.find(c => c.id === formData.id)} // Disable ID edit if executing update mostly
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Name</label>
                                            <input
                                                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
                                                value={formData.name}
                                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                placeholder="Invoice Extraction Rules"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Scopes (comma sep)</label>
                                        <input
                                            className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
                                            value={formData.scopes}
                                            onChange={e => setFormData({ ...formData, scopes: e.target.value })}
                                            placeholder="global, app:invoice-processor"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Content (Markdown/Text)</label>
                                        <textarea
                                            className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700 font-mono text-sm h-96"
                                            value={formData.content}
                                            onChange={e => setFormData({ ...formData, content: e.target.value })}
                                            placeholder="Enter system prompt or context data here..."
                                            required
                                        />
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        {formData.id && (
                                            <Button type="button" variant="destructive" onClick={() => handleDelete(formData.id)}>
                                                Delete
                                            </Button>
                                        )}
                                        <Button type="button" variant="outline" onClick={handleCancel}>
                                            Cancel
                                        </Button>
                                        <Button type="submit">
                                            Save Context
                                        </Button>
                                    </div>
                                </form>
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center border rounded-lg border-dashed p-10 text-gray-400">
                                Select a context to edit or create a new one.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
