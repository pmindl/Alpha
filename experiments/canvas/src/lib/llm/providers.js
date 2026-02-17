/**
 * LLM Provider Registry
 * Defines supported models with their capabilities and cost tiers.
 */

export const PROVIDERS = {
    OPENAI: 'openai',
    ANTHROPIC: 'anthropic',
    GOOGLE: 'google',
};

export const COST_TIER = {
    FAST: 'fast',      // Cheap and fast models
    STANDARD: 'standard', // Balanced cost/performance
    POWER: 'power',    // Most capable, highest cost
};

/**
 * Model registry with capabilities metadata.
 * Used by ModelRouter to select appropriate models.
 */
export const MODEL_REGISTRY = {
    // OpenAI Models
    'gpt-4o-mini': {
        provider: PROVIDERS.OPENAI,
        displayName: 'GPT-4o Mini',
        costTier: COST_TIER.FAST,
        contextWindow: 128000,
        reasoning: 'basic',
    },
    'gpt-4o': {
        provider: PROVIDERS.OPENAI,
        displayName: 'GPT-4o',
        costTier: COST_TIER.STANDARD,
        contextWindow: 128000,
        reasoning: 'advanced',
    },
    'gpt-4.5-preview': {
        provider: PROVIDERS.OPENAI,
        displayName: 'GPT-4.5 Preview',
        costTier: COST_TIER.POWER,
        contextWindow: 128000,
        reasoning: 'expert',
    },

    // Anthropic Models
    'claude-3-haiku-20240307': {
        provider: PROVIDERS.ANTHROPIC,
        displayName: 'Claude 3 Haiku',
        costTier: COST_TIER.FAST,
        contextWindow: 200000,
        reasoning: 'basic',
    },
    'claude-sonnet-4-20250514': {
        provider: PROVIDERS.ANTHROPIC,
        displayName: 'Claude Sonnet 4',
        costTier: COST_TIER.STANDARD,
        contextWindow: 200000,
        reasoning: 'advanced',
    },
    'claude-3-opus-20240229': {
        provider: PROVIDERS.ANTHROPIC,
        displayName: 'Claude 3 Opus',
        costTier: COST_TIER.POWER,
        contextWindow: 200000,
        reasoning: 'expert',
    },

    // Google Models
    'gemini-1.5-flash': {
        provider: PROVIDERS.GOOGLE,
        displayName: 'Gemini 1.5 Flash',
        costTier: COST_TIER.FAST,
        contextWindow: 1000000,
        reasoning: 'basic',
    },
    'gemini-1.5-pro': {
        provider: PROVIDERS.GOOGLE,
        displayName: 'Gemini 1.5 Pro',
        costTier: COST_TIER.STANDARD,
        contextWindow: 2000000,
        reasoning: 'advanced',
    },
    'gemini-2.0-pro': {
        provider: PROVIDERS.GOOGLE,
        displayName: 'Gemini 2.0 Pro',
        costTier: COST_TIER.POWER,
        contextWindow: 2000000,
        reasoning: 'expert',
    },
};

/**
 * Get all models for a specific provider.
 */
export function getModelsByProvider(provider) {
    return Object.entries(MODEL_REGISTRY)
        .filter(([, meta]) => meta.provider === provider)
        .map(([id, meta]) => ({ id, ...meta }));
}

/**
 * Get all models for a specific cost tier.
 */
export function getModelsByTier(tier) {
    return Object.entries(MODEL_REGISTRY)
        .filter(([, meta]) => meta.costTier === tier)
        .map(([id, meta]) => ({ id, ...meta }));
}

/**
 * Get model options for UI dropdowns.
 */
export function getModelOptions() {
    return Object.entries(MODEL_REGISTRY).map(([id, meta]) => ({
        value: id,
        label: meta.displayName,
        provider: meta.provider,
    }));
}
