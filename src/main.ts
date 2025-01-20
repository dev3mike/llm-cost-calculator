/**
 * LLM Cost Calculator
 * A utility for calculating token counts and costs for various LLM models
 */

import { Tiktoken } from "tiktoken/lite";
import { load } from "tiktoken/load";
import registry from "tiktoken/registry.json";
import models from "tiktoken/model_to_encoding.json";
import localModelPricesRaw from "../models.json";
import { setTimeout } from "timers/promises";

// Types
interface ModelPricing {
  input_cost_per_token?: number;
  output_cost_per_token?: number;
}

interface TokenizerCache {
  model: {
    explicit_n_vocab: number | undefined;
    pat_str: string;
    special_tokens: Record<string, number>;
    bpe_ranks: string;
  };
  encoder: Tiktoken;
}

interface FetchOptions {
  offline?: boolean;
  timeout?: number;
}

interface OpenRouterModel {
  id: string;
  name: string;
  created: number;
  description: string;
  context_length: number;
  architecture: {
    modality: string;
    tokenizer: string;
    instruct_type: string | null;
  };
  pricing: {
    prompt: string;
    completion: string;
    image: string;
    request: string;
  };
  top_provider: {
    context_length: number;
    max_completion_tokens: number | null;
    is_moderated: boolean;
  };
  per_request_limits: null;
}

interface OpenRouterResponse {
  data: OpenRouterModel[];
  message?: string;
  status?: number;
}

// Constants
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/models";
const DEFAULT_TIMEOUT = 5000; // 5 seconds
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour in milliseconds

// Cache for tokenizer instances and API responses
const tokenizerCache: Record<string, TokenizerCache> = {};
export let modelPricesCache: {
  timestamp: number;
  data: Record<string, ModelPricing>;
} | null = null;

// For testing purposes
export function resetCache() {
  modelPricesCache = null;
}

// Transform local model prices to correct format
const localModelPrices: Record<string, ModelPricing> = {};
for (const [key, value] of Object.entries(localModelPricesRaw)) {
  if (typeof value === 'object' && value !== null) {
    localModelPrices[key] = {
      input_cost_per_token: (value as any).input_cost_per_token,
      output_cost_per_token: (value as any).output_cost_per_token
    };
  }
}

/**
 * Fetches model data from OpenRouter API with timeout and retries
 * @param options Configuration options for fetching
 * @returns Model pricing data
 */
async function fetchModelData(options: FetchOptions = {}): Promise<Record<string, ModelPricing>> {
  const { offline = false, timeout = DEFAULT_TIMEOUT } = options;

  // If offline mode is requested, use local models
  if (offline) {
    return localModelPrices;
  }

  // Check cache first
  const now = Date.now();
  if (modelPricesCache && (now - modelPricesCache.timestamp) < CACHE_DURATION) {
    return modelPricesCache.data;
  }

  // Try to fetch from OpenRouter API with timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(timeout).then(() => controller.abort());

    const response = await fetch(OPENROUTER_API_URL, {
      signal: controller.signal
    });

    clearTimeout(timeoutId as any);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseData = await response.json() as { data: Array<{ id: string; pricing: { prompt: string; completion: string } }> };
    
    if (!responseData || !Array.isArray(responseData.data)) {
      throw new Error('Invalid response format from OpenRouter API');
    }

    // Transform OpenRouter data to our format
    const modelPrices: Record<string, ModelPricing> = {};
    
    for (const model of responseData.data) {
      modelPrices[model.id] = {
        input_cost_per_token: Number(model.pricing.prompt) || undefined,
        output_cost_per_token: Number(model.pricing.completion) || undefined
      };
    }

    // Update cache
    modelPricesCache = {
      timestamp: now,
      data: modelPrices
    };

    return modelPrices;

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`Failed to fetch from OpenRouter API: ${errorMessage}. Using local models as fallback.`);
    return localModelPrices;
  }
}

/**
 * Initializes a tokenizer for a given model
 * @returns Initialized tokenizer instance
 */
async function initializeTokenizer(): Promise<TokenizerCache> {
/**
 * For now we will only use gpt-4o as the default model
 * TODO: Add support for other models
 */
  const modelName = "gpt-4o";

  if (!tokenizerCache[modelName]) {
    const registryInfo = (registry as any)[(models as any)[modelName]];
    const model = await load(registryInfo);
    const encoder = new Tiktoken(
      model.bpe_ranks,
      model.special_tokens,
      model.pat_str
    );

    tokenizerCache[modelName] = { model, encoder };
  }

  return tokenizerCache[modelName];
}

/**
 * Counts tokens in a given text using the specified model's tokenizer
 * @param model Model name to use for tokenization
 * @param text Text to tokenize
 * @returns Number of tokens in the text
 */
async function countTokens(text: string): Promise<number> {
  if (!text) return 0;

  const { encoder } = await initializeTokenizer();
  return encoder.encode(text).length;
}

/**
 * Estimates cost based on token counts and model pricing
 * @param params Parameters for cost estimation
 * @returns Estimated cost in USD
 */
function estimateCost({
  model,
  inputTokens = 0,
  outputTokens = 0,
  modelPrices
}: {
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  modelPrices: Record<string, ModelPricing>;
}): number {
  const modelPrice = modelPrices[model];
  if (!modelPrice) return 0;

  const { input_cost_per_token = 0, output_cost_per_token = 0 } = modelPrice;

  return inputTokens * input_cost_per_token + outputTokens * output_cost_per_token;
}

/**
 * Tokenizes input/output text and estimates the cost based on model pricing
 * @param params Parameters for tokenization and cost estimation
 * @returns Token counts and estimated cost
 */
export async function getEstimatedCost({
    model,
    input,
    output,
    options = {}
  }: {
    model: string;
    input?: string;
    output?: string;
    options?: FetchOptions;
  }): Promise<{
    inputTokens: number;
    outputTokens: number;
    cost: number;
  }> {
    const inputTokens = (input && (await countTokens(input))) || 0;
    const outputTokens = (output && (await countTokens(output))) || 0;
  
    // Fetch model pricing data with provided options
    const modelPrices = await fetchModelData(options);
    const cost = estimateCost({ model, inputTokens, outputTokens, modelPrices });
  
    return {
      inputTokens,
      outputTokens,
      cost
    };
  }