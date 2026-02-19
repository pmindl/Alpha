import fs from 'fs';
import path from 'path';
import { z } from 'zod';

// Schema Definition
export const ContextItemSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    content: z.string(), // The actual prompt or context data
    scopes: z.array(z.string()).default(['global']), // 'global', 'app:invoice', etc.
    updatedAt: z.string().datetime().optional()
});

export const ContextSchema = z.object({
    contexts: z.array(ContextItemSchema)
});

export type ContextItem = z.infer<typeof ContextItemSchema>;
export type ContextData = z.infer<typeof ContextSchema>;

export class ContextManager {
    private storagePath: string;
    private data: ContextData;

    constructor(storagePath: string) {
        this.storagePath = storagePath;
        this.data = this.load();
    }

    private load(): ContextData {
        if (!fs.existsSync(this.storagePath)) {
            return { contexts: [] };
        }

        try {
            const fileContent = fs.readFileSync(this.storagePath, 'utf-8');
            const parsed = JSON.parse(fileContent);
            return ContextSchema.parse(parsed);
        } catch (error) {
            // If file is corrupted or empty, start fresh but warn
            console.warn(`Failed to parse context file at ${this.storagePath}: ${error}`);
            return { contexts: [] };
        }
    }

    public save(): void {
        fs.mkdirSync(path.dirname(this.storagePath), { recursive: true });
        const jsonString = JSON.stringify(this.data, null, 2);
        fs.writeFileSync(this.storagePath, jsonString);
    }

    public addContext(item: ContextItem): void {
        const index = this.data.contexts.findIndex(c => c.id === item.id);
        const newItem = {
            ...item,
            updatedAt: new Date().toISOString()
        };

        if (index >= 0) {
            this.data.contexts[index] = newItem;
        } else {
            this.data.contexts.push(newItem);
        }
        this.save();
    }

    public getContext(id: string): ContextItem | undefined {
        return this.data.contexts.find(c => c.id === id);
    }

    public removeContext(id: string): boolean {
        const initialLength = this.data.contexts.length;
        this.data.contexts = this.data.contexts.filter(c => c.id !== id);
        if (this.data.contexts.length !== initialLength) {
            this.save();
            return true;
        }
        return false;
    }

    public listContexts(scope?: string): ContextItem[] {
        if (!scope) {
            return this.data.contexts;
        }
        return this.data.contexts.filter(c => c.scopes.includes(scope) || c.scopes.includes('global'));
    }

    public getAllContexts(): Record<string, string> {
        // Return a map of ID -> Content for easy consumption
        return this.data.contexts.reduce((acc, curr) => {
            acc[curr.id] = curr.content;
            return acc;
        }, {} as Record<string, string>);
    }
}
