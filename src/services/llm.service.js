/**
 * LLM Service - Handles OpenAI, OpenRouter, and Ollama integration
 * Provides intelligent chat responses with temperature control and token tracking
 */

const axios = require('axios');

class LLMService {
  constructor() {
    // Provider: 'openai', 'openrouter', or 'ollama'
    this.provider = process.env.LLM_PROVIDER || 'openrouter';
    
    // OpenAI configuration
    this.apiKey = process.env.OPENAI_API_KEY;
    
    // OpenRouter configuration
    this.openrouterApiKey = process.env.OPENROUTER_API_KEY;
    this.openrouterBaseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
    this.openrouterReferer = process.env.OPENROUTER_REFERER || 'https://unimart.app';
    
    // Model selection
    this.model = process.env.LLM_MODEL || 'meta-llama/llama-3.2-3b-instruct:free';
    
    // Ollama configuration
    this.ollamaUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434';
    
    // Common parameters
    this.temperature = parseFloat(process.env.LLM_TEMPERATURE || '0.7');
    this.maxTokens = parseInt(process.env.LLM_MAX_TOKENS || '500');
    this.timeout = parseInt(process.env.LLM_TIMEOUT || '30000'); // 30s for remote APIs
    
    // Validate provider
    if (!['openai', 'openrouter', 'ollama'].includes(this.provider)) {
      console.warn(`⚠️ Unknown LLM provider: ${this.provider}, defaulting to openrouter`);
      this.provider = 'openrouter';
    }
    
    console.log(`✅ LLM Service initialized with provider: ${this.provider}, model: ${this.model}`);
  }

  /**
   * Generate response using OpenAI API
   */
  async _generateOpenAIResponse(systemPrompt, userMessage, conversationHistory) {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userMessage },
    ];

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: this.model,
        messages,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
        top_p: 0.95,
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: this.timeout,
      }
    );

    return {
      text: response.data.choices[0].message.content,
      tokens: {
        prompt: response.data.usage.prompt_tokens,
        completion: response.data.usage.completion_tokens,
        total: response.data.usage.total_tokens,
      },
      model: this.model,
    };
  }

  /**
   * Generate response using OpenRouter API
   * Supports free models like meta-llama/llama-3.2-3b-instruct:free
   */
  async _generateOpenRouterResponse(systemPrompt, userMessage, conversationHistory) {
    if (!this.openrouterApiKey) {
      throw new Error(
        'OpenRouter API key not configured. Set OPENROUTER_API_KEY environment variable.'
      );
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userMessage },
    ];

    try {
      const response = await axios.post(
        `${this.openrouterBaseUrl}/chat/completions`,
        {
          model: this.model,
          messages,
          temperature: this.temperature,
          max_tokens: this.maxTokens,
          top_p: 0.95,
        },
        {
          headers: {
            Authorization: `Bearer ${this.openrouterApiKey}`,
            'HTTP-Referer': this.openrouterReferer,
            'Content-Type': 'application/json',
            'X-Title': 'UniMart Riri Chat',
          },
          timeout: this.timeout,
        }
      );

      if (!response.data?.choices?.[0]?.message?.content) {
        throw new Error('Invalid response from OpenRouter API');
      }

      return {
        text: response.data.choices[0].message.content,
        tokens: {
          prompt: response.data.usage?.prompt_tokens || 0,
          completion: response.data.usage?.completion_tokens || 0,
          total: response.data.usage?.total_tokens || 0,
        },
        model: this.model,
      };
    } catch (error) {
      console.error('❌ OpenRouter API Error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
      });
      throw new Error(`OpenRouter Error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Generate response using local Ollama
   */
  async _generateOllamaResponse(systemPrompt, userMessage, conversationHistory) {
    const messagesText = conversationHistory
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join('\n');

    const fullPrompt = `System: ${systemPrompt}\n\n${messagesText}\nuser: ${userMessage}\nassistant:`;

    const response = await axios.post(
      `${this.ollamaUrl}/api/generate`,
      {
        model: this.model,
        prompt: fullPrompt,
        temperature: this.temperature,
        stream: false,
      },
      { timeout: this.timeout }
    );

    return {
      text: response.data.response.trim(),
      tokens: {
        prompt: 0, // Ollama doesn't provide token counts
        completion: 0,
        total: 0,
      },
      model: this.model,
    };
  }

  /**
   * Generate chat response with context
   */
  async generateResponse(systemPrompt, userMessage, conversationHistory = [], context = '') {
    try {
      // Add RAG context to system prompt
      const enhancedSystemPrompt = `${systemPrompt}\n\n## Context:\n${context || 'No specific context available.'}`;

      if (this.provider === 'ollama') {
        return await this._generateOllamaResponse(
          enhancedSystemPrompt,
          userMessage,
          conversationHistory
        );
      } else if (this.provider === 'openrouter') {
        return await this._generateOpenRouterResponse(
          enhancedSystemPrompt,
          userMessage,
          conversationHistory
        );
      } else {
        return await this._generateOpenAIResponse(
          enhancedSystemPrompt,
          userMessage,
          conversationHistory
        );
      }
    } catch (error) {
      console.error('❌ LLM Error:', error.message);
      throw new Error(`LLM Service Error: ${error.message}`);
    }
  }

  /**
   * Build system prompt for Riri
   */
  buildSystemPrompt(userContext = {}) {
    return `You are RIRI, a helpful AI shopping assistant for UniMart - a campus student marketplace where university students buy and sell used items, services, food, and event tickets.

Your personality:
- Friendly and encouraging to student shoppers
- Efficient and helpful
- Knowledge of campus life and student needs
- Support for both buyers and sellers

Your responsibilities:
1. Help students find products (textbooks, electronics, fashion, furniture, etc.)
2. Recommend campus services (tutoring, hair braiding, photography, cleaning, etc.)
3. Suggest food options from verified student vendors
4. Provide information about campus events and ticket sales
5. Guide users through the UniMart buying process
6. Maintain a professional yet casual tone

Important guidelines:
- Always mention prices in Cedis (₵) when available
- Recommend products within the user's budget when possible
- Prioritize campus-verified sellers and items
- If you don't know specific information, admit it and suggest how to find it
- Keep responses concise (2-3 sentences max, unless detailed explanation needed)
- Use emojis sparingly but appropriately 🛍️ 📚 🍛 🎟️

User Campus Context: ${userContext.campus || 'Not specified'}
User Preferences: ${userContext.preferences?.categories?.join(', ') || 'All categories'}`;
  }

  /**
   * Check if response indicates the LLM couldn't answer
   */
  _couldNotAnswer(response) {
    const lowercaseResponse = response.toLowerCase();
    const indicators = [
      'i don\'t know',
      'i\'m not sure',
      'i cannot',
      'i cannot provide',
      'not available',
      'no information',
      'unable to',
      'i don\'t have',
    ];

    return indicators.some((indicator) => lowercaseResponse.includes(indicator));
  }

  /**
   * Format RAG context for inclusion in prompt
   */
  formatRAGContext(products = [], services = [], foods = []) {
    let context = '';

    if (products.length > 0) {
      context += `\n## Available Products:\n`;
      products.forEach((p) => {
        context += `- ${p.name}: ₵${p.price} (Stock: ${p.stock}) - ${p.description || ''}\n`;
      });
    }

    if (services.length > 0) {
      context += `\n## Available Services:\n`;
      services.forEach((s) => {
        context += `- ${s.name} by ${s.provider}: ₵${s.price} - ${s.description || ''}\n`;
      });
    }

    if (foods.length > 0) {
      context += `\n## Available Food:\n`;
      foods.forEach((f) => {
        context += `- ${f.name} by ${f.vendor}: ₵${f.price} - Delivery: ${f.deliveryTime || 'ASAP'}\n`;
      });
    }

    return context;
  }
}

module.exports = new LLMService();
