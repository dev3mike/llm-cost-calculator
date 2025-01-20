# 🧮 LLM Cost Calculator

A powerful Node.js library to calculate token counts and estimated costs for Large Language Models (LLMs).

## ✨ Features

- 🎯 Accurate token counting for various LLM models
- 💰 Real-time cost estimation using up-to-date pricing from [OpenRouter API](https://openrouter.ai/api/v1/models)
- 🔄 Auto-fetches latest model prices from OpenRouter API
- 🔌 Works offline with built-in pricing data
- ⚡ Fast and efficient with caching support

## 📦 Installation

```bash
npm install llm-cost-calculator
```

## 🚀 Quick Start

```typescript
import { getEstimatedCost } from 'llm-cost-calculator';

// Calculate cost for a conversation with realtime prices
const result = await getEstimatedCost({
  model: 'anthropic/claude-3.5-sonnet',
  input: 'Write a function to calculate fibonacci numbers.',
  output: `Here's a recursive function to calculate Fibonacci numbers:

function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}`
//   options: {
//     offline: true // Pass this option to use local pricing data
//   }
});

console.log(result);
// Output:
// {
//   inputTokens: 9,
//   outputTokens: 42,
//   cost: 0.000153 // Cost in USD
// }
```

## 🛠️ API Reference

### `getEstimatedCost(params)`

Main function to calculate tokens and cost.

#### Parameters:

- `model` (string): Name of the LLM model
- `input` (string, optional): Input/prompt text
- `output` (string, optional): Output/completion text
- `options` (object, optional):
  - `offline` (boolean): Run in offline mode using local pricing data
  - `timeout` (number): API request timeout in milliseconds

#### Returns:

```typescript
{
  inputTokens: number;  // Number of tokens in input
  outputTokens: number; // Number of tokens in output
  cost: number;        // Estimated cost in USD
}
```

## 🌐 Supported Models

Supports a wide range of models including:

### OpenAI Models
- `openai/gpt-4` - GPT-4 base model
- `openai/gpt-3.5-turbo` - Fast and cost-effective
- `openai/gpt-3.5-turbo-0125` - Latest GPT-3.5 with 16k context

### Anthropic Models
- `anthropic/claude-3.5-sonnet` - Latest Claude 3.5 Sonnet
- `anthropic/claude-3-sonnet` - Claude 3 Sonnet base
- `anthropic/claude-3.5-sonnet:beta` - Self-moderated version

### Google Models
- `google/gemini-2.0-flash-thinking-exp:free` - Experimental Gemini with thinking process
- `google/palm-2-chat-bison` - PaLM 2 for general chat
- `google/palm-2-codechat-bison` - PaLM 2 specialized for code

### Meta/Llama Models
- `meta-llama/llama-2-13b-chat` - Llama 2 13B chat model
- `mistralai/codestral-2501` - Specialized for coding tasks
- `microsoft/phi-4` - Efficient 14B parameter model

### Other Notable Models
- `deepseek/deepseek-chat` - DeepSeek V3 for general chat
- `qwen/qvq-72b-preview` - Visual reasoning specialist
- `minimax/minimax-01` - Text and image understanding


[All models are available here](https://openrouter.ai/api/v1/models)

Pricing data is automatically fetched from [OpenRouter API](https://openrouter.ai/api/v1/models), with fallback to local pricing data. The library caches pricing data to minimize API calls while ensuring you always have access to the latest rates.

> Note: Model availability and pricing may vary. Check the OpenRouter API for the most up-to-date list and pricing information.

## 📝 License

MIT

## 🤝 Contributing

Contributions are welcome! Feel free to:
1. Open issues for bugs or feature requests
2. Submit pull requests
3. Improve documentation
4. Share your use cases

## 💡 Tips

- Use offline mode when you don't need real-time pricing updates
- Cache results for repeated calculations
- Check token counts before making API calls to estimate costs
