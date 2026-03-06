import { connect } from '@lancedb/lancedb';
import path from 'path';

// Use the local data folder (copied by Docker or Git) as the primary knowledge base.
// In Coolify, setting LANCEDB_URI=/app/data/lancedb can be used if an external volume is mounted.
const DB_URI = process.env.LANCEDB_URI || path.join(process.cwd(), 'data/lancedb');

// Embedding model configuration
const EMBEDDING_MODEL = 'gemini-embedding-001';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Call the Gemini embedding API directly (bypasses old SDK version issues).
 */
async function getEmbedding(text: string): Promise<number[]> {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) throw new Error("Missing Gemini API Key for Knowledge Base");

    const url = `${API_BASE}/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            content: {
                parts: [{ text }],
            },
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Embedding API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    return data.embedding.values;
}

export interface KnowledgeChunk {
    filename: string;
    content: string;
    score: number;
}

export async function searchKnowledgeBase(query: string, limit: number = 3): Promise<KnowledgeChunk[]> {
    try {
        const dbPath = path.resolve(process.cwd(), DB_URI);
        const db = await connect(dbPath);

        // Check if table exists
        const tables = await db.tableNames();
        if (!tables.includes('knowledge_base')) {
            console.warn('⚠️ Knowledge base table not found. Is the ingestor running?');
            return [];
        }

        const table = await db.openTable('knowledge_base');

        // Generate embedding for query
        const queryVector = await getEmbedding(query);

        // Search
        const searchResults = await table.vectorSearch(queryVector)
            .limit(limit)
            .toArray();

        return searchResults.map((row: any) => ({
            filename: row.filename,
            content: row.content,
            score: row._distance // Lower is better for L2
        }));

    } catch (error) {
        console.error('❌ Error searching knowledge base:', error);
        return [];
    }
}
