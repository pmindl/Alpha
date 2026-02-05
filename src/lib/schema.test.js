import { describe, it, expect } from 'vitest';
import { createNode, NODE_TYPES, NODE_DEFAULTS } from './schema';

describe('Schema Utilities', () => {
    it('should create a node with correct structure', () => {
        const id = 'test-node';
        const position = { x: 100, y: 100 };
        const node = createNode(id, NODE_TYPES.INPUT, position);

        expect(node.id).toBe(id);
        expect(node.position).toEqual(position);
        expect(node.type).toBe(NODE_TYPES.INPUT); // Input is a standard type
        expect(node.data.label).toBe(NODE_DEFAULTS[NODE_TYPES.INPUT].label);
    });

    it('should handle agent node type correctly', () => {
        const id = 'agent-node';
        const position = { x: 0, y: 0 };
        const node = createNode(id, NODE_TYPES.AGENT, position);

        // Agent nodes are rendered as 'default' but have 'agent' as internal type
        expect(node.type).toBe('default');
        expect(node.data.type).toBe(NODE_TYPES.AGENT);
        expect(node.data._schemaVersion).toBe('1.0.0');
        expect(node.data.model).toBeDefined();
    });

    it('should fallback to default for unknown types', () => {
        const id = 'unknown-node';
        const position = { x: 0, y: 0 };
        const node = createNode(id, 'UNKNOWN_TYPE', position);

        expect(node.data.label).toBe(NODE_DEFAULTS[NODE_TYPES.DEFAULT].label);
    });
});
