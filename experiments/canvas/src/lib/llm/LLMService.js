/**
 * Unified LLM Service
 * Provides a single interface to call multiple LLM providers using Vercel AI SDK.
 */

import { generateText, streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { MODEL_REGISTRY, PROVIDERS } from './providers.js';
import { routeTask, ROUTING_MODE } from './ModelRouter.js';

/**
 * Get or create provider client instance.
 * @param {string} provider - Provider identifier.
 * @returns {object} - Provider client instance.
 */
function getProviderClient(provider) {
    switch (provider) {
        case PROVIDERS.OPENAI:
            return createOpenAI({
                apiKey: localStorage.getItem('OPENAI_API_KEY') || '',
            });
        case PROVIDERS.ANTHROPIC:
            return createAnthropic({
                apiKey: localStorage.getItem('ANTHROPIC_API_KEY') || '',
            });
        case PROVIDERS.GOOGLE:
            return createGoogleGenerativeAI({
                apiKey: localStorage.getItem('GOOGLE_API_KEY') || '',
            });
        default:
            throw new Error(`Unknown provider: ${provider}`);
    }
}

/**
 * Create a model instance for the given modelId.
 * @param {string} modelId - Model identifier from MODEL_REGISTRY.
 * @returns {object} - AI SDK model instance.
 */
function createModel(modelId) {
    const meta = MODEL_REGISTRY[modelId];
    if (!meta) {
        throw new Error(`Unknown model: ${modelId}`);
    }
    const client = getProviderClient(meta.provider);
    return client(modelId);
}

/**
 * Generate text using the unified LLM interface.
 * @param {object} options - Generation options.
 * @param {string} options.prompt - The prompt to send.
 * @param {string} [options.model='auto'] - Model ID or 'auto' for smart routing.
 * @param {string} [options.routingMode] - Routing mode if model is 'auto'.
 * @param {number} [options.temperature=0.7] - Sampling temperature.
 * @param {number} [options.maxTokens=2048] - Maximum tokens to generate.
 * @returns {Promise<{ text: string, modelId: string, usage: object }>}
 */
export async function chat({
    prompt,
    model = 'auto',
    routingMode = ROUTING_MODE.AUTO,
    temperature = 0.7,
    maxTokens = 2048,
}) {
    let modelId = model;
    let routingReason = null;

    // Smart routing if model is 'auto'
    if (model === 'auto') {
        const routing = routeTask(prompt, routingMode);
        if (!routing.modelId) {
            throw new Error(routing.reason);
        }
        modelId = routing.modelId;
        routingReason = routing.reason;
        console.log(`[LLMService] ${routingReason}`);
    }

    const modelInstance = createModel(modelId);

    const result = await generateText({
        model: modelInstance,
        prompt,
        temperature,
        maxTokens,
    });

    return {
        text: result.text,
        modelId,
        usage: result.usage,
        routingReason,
    };
}

/**
 * Stream text using the unified LLM interface.
 * @param {object} options - Same as chat() options.
 * @returns {AsyncGenerator<string>} - Text stream.
 */
export async function* chatStream({
    prompt,
    model = 'auto',
    routingMode = ROUTING_MODE.AUTO,
    temperature = 0.7,
    maxTokens = 2048,
}) {
    let modelId = model;

    if (model === 'auto') {
        const routing = routeTask(prompt, routingMode);
        if (!routing.modelId) {
            throw new Error(routing.reason);
        }
        modelId = routing.modelId;
        console.log(`[LLMService Stream] ${routing.reason}`);
    }

    const modelInstance = createModel(modelId);

    const result = await streamText({
        model: modelInstance,
        prompt,
        temperature,
        maxTokens,
    });

    for await (const chunk of result.textStream) {
        yield chunk;
    }
}

/**
 * Export routing utilities for external use.
 */
export { routeTask, ROUTING_MODE } from './ModelRouter.js';
export { MODEL_REGISTRY, PROVIDERS, getModelOptions } from './providers.js';
