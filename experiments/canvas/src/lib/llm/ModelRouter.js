/**
 * Smart Model Router
 * Selects optimal LLM model based on task complexity and user preferences.
 */

import { MODEL_REGISTRY, COST_TIER, PROVIDERS } from './providers.js';

// Keywords that indicate complex tasks requiring powerful models
const COMPLEX_KEYWORDS = [
    'architect', 'design', 'refactor', 'optimize', 'security',
    'implement', 'debug', 'analyze', 'review', 'migration',
    'system', 'infrastructure', 'database', 'performance',
];

// Keywords indicating simple tasks suitable for fast models
const SIMPLE_KEYWORDS = [
    'hello', 'hi', 'thanks', 'translate', 'summarize',
    'explain', 'what is', 'define', 'list',
];

/**
 * User routing preferences.
 */
export const ROUTING_MODE = {
    AUTO: 'auto',           // Smart routing based on task analysis
    MINIMIZE_COST: 'cost',  // Always prefer cheapest model
    MAXIMIZE_QUALITY: 'quality', // Always prefer most capable model
};

/**
 * Analyze prompt complexity and return a cost tier.
 * @param {string} prompt - The user's prompt text.
 * @returns {string} - COST_TIER value
 */
function analyzeComplexity(prompt) {
    const lowerPrompt = prompt.toLowerCase();
    const wordCount = prompt.split(/\s+/).length;

    // Check for complex keywords
    const hasComplexKeywords = COMPLEX_KEYWORDS.some(kw => lowerPrompt.includes(kw));

    // Check for simple keywords
    const hasSimpleKeywords = SIMPLE_KEYWORDS.some(kw => lowerPrompt.includes(kw));

    // Long prompts (>200 words) suggest complex tasks
    if (wordCount > 200 || hasComplexKeywords) {
        return COST_TIER.POWER;
    }

    // Short prompts (<50 words) with simple keywords -> fast tier
    if (wordCount < 50 && hasSimpleKeywords) {
        return COST_TIER.FAST;
    }

    // Default to standard tier
    return COST_TIER.STANDARD;
}

/**
 * Get the best available model for a given tier.
 * Prefers models based on provider order: Google > Anthropic > OpenAI (for value).
 * @param {string} tier - The cost tier to select from.
 * @param {string[]} availableProviders - Providers with configured API keys.
 * @returns {string|null} - Model ID or null if none available.
 */
function selectModelForTier(tier, availableProviders) {
    const providerPriority = [PROVIDERS.GOOGLE, PROVIDERS.ANTHROPIC, PROVIDERS.OPENAI];

    for (const provider of providerPriority) {
        if (!availableProviders.includes(provider)) continue;

        const model = Object.entries(MODEL_REGISTRY).find(
            ([, meta]) => meta.costTier === tier && meta.provider === provider
        );
        if (model) return model[0];
    }

    // Fallback: any model in the tier
    const fallback = Object.entries(MODEL_REGISTRY).find(
        ([, meta]) => meta.costTier === tier
    );
    return fallback ? fallback[0] : null;
}

/**
 * Get list of providers that have API keys configured.
 * @returns {string[]} - Array of provider identifiers.
 */
function getAvailableProviders() {
    const providers = [];
    if (localStorage.getItem('OPENAI_API_KEY')) providers.push(PROVIDERS.OPENAI);
    if (localStorage.getItem('ANTHROPIC_API_KEY')) providers.push(PROVIDERS.ANTHROPIC);
    if (localStorage.getItem('GOOGLE_API_KEY')) providers.push(PROVIDERS.GOOGLE);
    return providers;
}

/**
 * Route a task to the optimal model.
 * @param {string} prompt - The task prompt to analyze.
 * @param {string} mode - Routing mode (auto, cost, quality).
 * @returns {{ modelId: string, provider: string, reason: string }}
 */
export function routeTask(prompt, mode = ROUTING_MODE.AUTO) {
    const availableProviders = getAvailableProviders();

    if (availableProviders.length === 0) {
        return {
            modelId: null,
            provider: null,
            reason: 'No API keys configured. Please add at least one provider key in Settings.',
        };
    }

    let targetTier;

    switch (mode) {
        case ROUTING_MODE.MINIMIZE_COST:
            targetTier = COST_TIER.FAST;
            break;
        case ROUTING_MODE.MAXIMIZE_QUALITY:
            targetTier = COST_TIER.POWER;
            break;
        case ROUTING_MODE.AUTO:
        default:
            targetTier = analyzeComplexity(prompt);
            break;
    }

    const modelId = selectModelForTier(targetTier, availableProviders);

    if (!modelId) {
        // Fallback to any available model
        const anyModel = Object.entries(MODEL_REGISTRY).find(
            ([, meta]) => availableProviders.includes(meta.provider)
        );
        if (anyModel) {
            return {
                modelId: anyModel[0],
                provider: anyModel[1].provider,
                reason: `Fallback: No ${targetTier} model available.`,
            };
        }
        return { modelId: null, provider: null, reason: 'No compatible models found.' };
    }

    const meta = MODEL_REGISTRY[modelId];
    return {
        modelId,
        provider: meta.provider,
        reason: `Selected ${meta.displayName} (${targetTier} tier) via ${mode} routing.`,
    };
}
