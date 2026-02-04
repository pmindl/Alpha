export const NODE_TYPES = {
    INPUT: 'input',
    DEFAULT: 'default',
    OUTPUT: 'output',
    AGENT: 'agent',
};

export const MODEL_OPTIONS = [
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    { value: 'claude-3-opus', label: 'Claude 3 Opus' },
    { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet' },
    { value: 'mistral-large', label: 'Mistral Large' },
];

export const NODE_DEFAULTS = {
    [NODE_TYPES.INPUT]: {
        label: 'Input',
    },
    [NODE_TYPES.DEFAULT]: {
        label: 'Processor',
    },
    [NODE_TYPES.OUTPUT]: {
        label: 'Output',
    },
    [NODE_TYPES.AGENT]: {
        label: 'AI Agent',
        systemPrompt: 'You are a helpful AI assistant.',
        model: 'gpt-4-turbo',
        temperature: 0.7,
        maxTokens: 2048,
        tools: [],
    },
};

/**
 * Creates a new node object conforming to the AI-Ready Schema.
 * @param {string} id - Unique ID for the node.
 * @param {string} type - Node type (from NODE_TYPES).
 * @param {object} position - {x, y} coordinates.
 * @returns {object} React Flow Node object.
 */
export const createNode = (id, type, position) => {
    const defaults = NODE_DEFAULTS[type] || NODE_DEFAULTS[NODE_TYPES.DEFAULT];

    // Map 'agent' type to 'default' for rendering, but keep 'type' in data for logic
    // This allows us to use standard React Flow nodes while storing rich metadata
    const renderType = type === NODE_TYPES.AGENT ? 'default' : type;

    return {
        id,
        type: renderType,
        position,
        data: {
            ...defaults,
            _schemaVersion: '1.0.0',
            type: type // Logical type stored in data
        },
    };
};
