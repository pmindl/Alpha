export const NODE_TYPES = {
    INPUT: 'input',
    DEFAULT: 'default',
    OUTPUT: 'output',
    AGENT: 'agent',
};

export const MODEL_OPTIONS = [
    // Auto-routing option
    { value: 'auto', label: '🤖 Auto-Detect (Smart Router)' },
    // OpenAI
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'openai' },
    { value: 'gpt-4o', label: 'GPT-4o', provider: 'openai' },
    { value: 'gpt-4.5-preview', label: 'GPT-4.5 Preview', provider: 'openai' },
    // Anthropic
    { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku', provider: 'anthropic' },
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', provider: 'anthropic' },
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus', provider: 'anthropic' },
    // Google
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', provider: 'google' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', provider: 'google' },
    { value: 'gemini-2.0-pro', label: 'Gemini 2.0 Pro', provider: 'google' },
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
        model: 'auto',  // Default to smart routing
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
