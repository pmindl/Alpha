"use client";

import { useEffect, useState } from "react";
import { Button } from "@alpha/ui";
import Link from "next/link";

interface Credential {
    id: string;
    scopes: string[];
    description?: string;
    // value is not returned by list
}

export default function CredentialsPage() {
    const [credentials, setCredentials] = useState<Credential[]>([]);
    const [loading, setLoading] = useState(true);

    const [newId, setNewId] = useState("");
    const [newValue, setNewValue] = useState("");
    const [newScopes, setNewScopes] = useState("global");
    const [newDesc, setNewDesc] = useState("");

    const fetchCredentials = () => {
        setLoading(true);
        fetch('/api/credentials')
            .then(res => res.json())
            .then(data => {
                setCredentials(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchCredentials();
    }, []);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        const scopesArray = newScopes.split(',').map(s => s.trim());

        const res = await fetch('/api/credentials', {
            method: 'POST',
            body: JSON.stringify({
                id: newId,
                value: newValue,
                scopes: scopesArray,
                description: newDesc
            })
        });

        if (res.ok) {
            setNewId("");
            setNewValue("");
            setNewDesc("");
            fetchCredentials();
        } else {
            alert("Failed to add credential");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(`Delete credential ${id}?`)) return;

        const res = await fetch(`/api/credentials?id=${id}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            fetchCredentials();
        } else {
            alert("Failed to delete credential");
        }
    };

    return (
        <div className="min-h-screen p-8 pb-20 sm:p-20 font-[family-name:var(--font-geist-sans)]">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold">Credentials Management</h1>
                    <Link href="/">
                        <Button variant="outline">Back to Dashboard</Button>
                    </Link>
                </div>

                <div className="bg-white dark:bg-zinc-900 border rounded-lg p-6 mb-8">
                    <h2 className="text-xl font-semibold mb-4">Add New Credential</h2>
                    <form onSubmit={handleAdd} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                            <label className="block text-sm font-medium mb-1">ID (Key)</label>
                            <input
                                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
                                value={newId}
                                onChange={e => setNewId(e.target.value)}
                                placeholder="OPENAI_API_KEY"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Value</label>
                            <input
                                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
                                value={newValue}
                                onChange={e => setNewValue(e.target.value)}
                                placeholder="sk-..."
                                type="password"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Scopes (comma sep)</label>
                            <input
                                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
                                value={newScopes}
                                onChange={e => setNewScopes(e.target.value)}
                                placeholder="global, app:invoice-processor"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Description</label>
                            <input
                                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
                                value={newDesc}
                                onChange={e => setNewDesc(e.target.value)}
                                placeholder="Main API Key"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <Button type="submit">Save Credential</Button>
                        </div>
                    </form>
                </div>

                <div className="bg-white dark:bg-zinc-900 border rounded-lg overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-zinc-50 dark:bg-zinc-800 border-b">
                            <tr>
                                <th className="p-4">ID</th>
                                <th className="p-4">Scopes</th>
                                <th className="p-4">Description</th>
                                <th className="p-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={4} className="p-4 text-center">Loading...</td></tr>
                            ) : credentials.length === 0 ? (
                                <tr><td colSpan={4} className="p-4 text-center">No credentials found</td></tr>
                            ) : credentials.map(cred => (
                                <tr key={cred.id} className="border-b last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                    <td className="p-4 font-mono">{cred.id}</td>
                                    <td className="p-4">
                                        {cred.scopes.map(s => (
                                            <span key={s} className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mr-1">
                                                {s}
                                            </span>
                                        ))}
                                    </td>
                                    <td className="p-4 text-sm text-gray-500">{cred.description}</td>
                                    <td className="p-4">
                                        <Button variant="destructive" size="sm" onClick={() => handleDelete(cred.id)}>
                                            Delete
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
