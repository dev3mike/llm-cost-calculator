/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getEstimatedCost, resetCache } from '../src/main';

// Mock Tiktoken class
vi.mock('tiktoken/lite', () => ({
  Tiktoken: class {
    constructor() {}
    encode(text: string) {
      return text === '' ? [] : [1, 2, 3]; // Always return 3 tokens for non-empty text
    }
  }
}));

// Mock tiktoken load function
vi.mock('tiktoken/load', () => ({
  load: () => Promise.resolve({
    explicit_n_vocab: 100,
    pat_str: '',
    special_tokens: {},
    bpe_ranks: ''
  })
}));

// Mock tiktoken registry and model mapping
vi.mock('tiktoken/registry.json', () => ({
  default: {
    'mock-encoding': 'mock-registry-info'
  }
}));

vi.mock('tiktoken/model_to_encoding.json', () => ({
  default: {
    'gpt-3.5-turbo': 'mock-encoding',
    'unknown-model': 'mock-encoding'
  }
}));

// Mock local model prices
vi.mock('../models.json', () => ({
  default: {
    'gpt-4': {
      input_cost_per_token: 0.00003,
      output_cost_per_token: 0.00006
    },
    'gpt-3.5-turbo': {
      input_cost_per_token: 0.0000015,
      output_cost_per_token: 0.000002
    }
  }
}));

describe('LLM Cost Calculator', () => {
  const mockModelPrices = {
    'gpt-4': {
      input_cost_per_token: 0.00003,
      output_cost_per_token: 0.00006
    },
    'gpt-3.5-turbo': {
      input_cost_per_token: 0.0000015,
      output_cost_per_token: 0.000002
    }
  };

  const mockApiResponse = {
    data: [
      {
        id: 'gpt-4',
        pricing: {
          prompt: '0.00003',
          completion: '0.00006'
        }
      },
      {
        id: 'gpt-3.5-turbo',
        pricing: {
          prompt: '0.0000015',
          completion: '0.000002'
        }
      }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module cache
    vi.doUnmock('../src/main');
    // Clear the cache
    resetCache();
    // Mock fetch for API calls
    global.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('openrouter.ai')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockApiResponse),
          text: () => Promise.resolve('mock text response')
        } as Response);
      }
      // For other requests
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve('mock data'),
        json: () => Promise.resolve({})
      } as Response);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('getEstimatedCost', () => {
    it('should correctly count tokens and estimate cost for input and output', async () => {
      const result = await getEstimatedCost({
        model: 'gpt-3.5-turbo',
        input: 'This is an example input prompt',
        output: 'This is an example output prompt',
        options: { offline: true }
      });
      expect(result.inputTokens).toBeGreaterThan(0);
      expect(result.outputTokens).toBeGreaterThan(0);
      const expectedCost = (result.inputTokens * 0.0000015) + (result.outputTokens * 0.000002);
      expect(result.cost).toBe(expectedCost);
    });

    it('should handle empty input/output', async () => {
      const result = await getEstimatedCost({
        model: 'gpt-3.5-turbo',
        input: '',
        output: '',
        options: { offline: true }
      });
      expect(result.inputTokens).toBe(0);
      expect(result.outputTokens).toBe(0);
      expect(result.cost).toBe(0);
    });

    it('should use offline mode when specified', async () => {
      await getEstimatedCost({
        model: 'gpt-3.5-turbo',
        input: 'Test',
        options: { offline: true }
      });

      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('openrouter.ai/api/v1/models'),
        expect.any(Object)
      );
    });

    it('should fetch from API in online mode', async () => {
      await getEstimatedCost({
        model: 'gpt-3.5-turbo',
        input: 'Test'
      });

      const fetchCalls = (global.fetch as any).mock.calls;
      expect(fetchCalls.some((call: any[]) => 
        call[0].includes('openrouter.ai/api/v1/models')
      )).toBe(true);
    });

    it('should handle API errors gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await getEstimatedCost({
        model: 'gpt-3.5-turbo',
        input: 'Test',
        options: { offline: false }
      });

      expect(result).toHaveProperty('inputTokens');
      expect(result).toHaveProperty('outputTokens');
      expect(result).toHaveProperty('cost');
      expect(result.cost).toBeCloseTo(3 * 0.0000015, 8); // Only input tokens cost from local model
    });

    it('should respect timeout option', async () => {
      const timeout = 5000;
      const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        return Promise.resolve(new Response(JSON.stringify({
          data: [{
            id: 'gpt-3.5-turbo',
            pricing: {
              prompt: '0.0000015',
              completion: '0.000002'
            }
          }]
        }), {
          status: 200,
          headers: new Headers({ 'Content-Type': 'application/json' })
        }));
      });
      
      // Reset cache and set up fetch mock
      resetCache();
      global.fetch = fetchMock;

      await getEstimatedCost({
        model: 'gpt-3.5-turbo',
        input: 'Hello',
        output: 'World',
        options: { timeout, offline: false }
      });

      expect(fetchMock).toHaveBeenCalled();
      const [url, init] = fetchMock.mock.calls[0];
      expect(url.includes('openrouter.ai/api/v1/models')).toBe(true);
      expect(init).toHaveProperty('signal');
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it('should handle unknown models', async () => {
      const result = await getEstimatedCost({
        model: 'unknown-model',
        input: 'Hello',
        output: 'World',
        options: { offline: true }
      });
      expect(result.inputTokens).toBe(3);
      expect(result.outputTokens).toBe(3);
      expect(result.cost).toBe(0); // Unknown model should have zero cost
    });
  });
});
