import { connect } from '@lancedb/lancedb';
import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';

const DB_URI = process.env.LANCEDB_URI || '../knowledge-ingestor/data/lancedb';
let genAI: GoogleGenerativeAI | null = null;
let model: any = null;

function getEmbeddingModel() {
    if (!model) {
        const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!apiKey) throw new Error("Missing Gemini API Key for Knowledge Base");
        genAI = new GoogleGenerativeAI(apiKey);
        // Using embedding-001 as fallback
        model = genAI.getGenerativeModel({ model: "embedding-001" });
    }
    return model;
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
        const result = await getEmbeddingModel().embedContent(query);
        const queryVector = result.embedding.values;

        // Search
        const searchResults = await table.vectorSearch(queryVector)
            .limit(limit)
            .toArray();

        return searchResults.map((row: any) => ({
            filename: row.filename,
            content: row.content,
            score: row._distance // Lower is better for L2, or usage dependent
        }));

    } catch (error) {
        console.error('❌ Error searching knowledge base:', error);
        return [];
    }
}
