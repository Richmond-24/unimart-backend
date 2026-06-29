// backend/utils/openrouter.js
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

async function getFetch() {
  if (typeof globalThis.fetch === 'function') {
    return globalThis.fetch;
  }
  const { default: fetch } = await import('node-fetch');
  return fetch;
}

async function callOpenRouter({ model, messages, max_tokens = 300, temperature = 0.7 }) {
  const fetch = await getFetch();
  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://unimart.com',
      'X-Title': 'Uni-Mart AI Assistant',
    },
    body: JSON.stringify({
      model: model || 'google/gemini-pro',
      messages,
      max_tokens,
      temperature,
    }),
  });
  if (!response.ok) throw new Error(`OpenRouter error: ${response.status}`);
  return await response.json();
}

module.exports = { callOpenRouter };