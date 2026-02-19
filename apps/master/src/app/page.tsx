"use client";

import { useEffect, useState } from "react";
import { Button } from "@alpha/ui";
import Link from "next/link";

interface AppStatus {
  id: string;
  name: string;
  url: string;
  status: 'online' | 'offline';
  code?: number;
  error?: string;
}

export default function Home() {
  const [statuses, setStatuses] = useState<AppStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/status')
      .then(res => res.json())
      .then(data => {
        setStatuses(data.apps || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start w-full max-w-4xl">
        <div className="flex justify-between items-center w-full">
          <div>
            <h1 className="text-4xl font-bold">Project Alpha</h1>
            <p className="text-gray-500">Orchestration & Management Console</p>
          </div>
          <div className="flex gap-2">
            <Link href="/settings/credentials">
              <Button variant="outline">Credentials</Button>
            </Link>
            <Link href="/settings/context">
              <Button variant="outline">Context</Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
          {loading ? (
            <p>Loading system status...</p>
          ) : statuses.map(app => (
            <div key={app.id} className="p-6 border rounded-lg shadow-sm bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-semibold">{app.name}</h3>
                <span className={`px-2 py-1 text-xs rounded-full ${app.status === 'online' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {app.status.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-2">{app.url}</p>
              {app.error && <p className="text-xs text-red-500">{app.error}</p>}

              <div className="mt-4 flex gap-2">
                {/* Actions could go here, e.g. "Restart" if we had that capability */}
                {app.status === 'online' && (
                  <a href={app.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                    Open App &rarr;
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
