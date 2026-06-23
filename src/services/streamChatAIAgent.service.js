/**
 * Stream Chat AI Agent Service (CommonJS)
 * Manages AI agents for Stream Chat channels
 * Uses OpenAI integration for smart responses
 */

const { StreamChat } = require('stream-chat');
let OpenAI = null;
try {
  OpenAI = require('openai/index.mjs').OpenAI;
} catch (err) {
  console.warn('⚠️  OpenAI package not available');
}
const productRAGService = require('./productRAG.service');
require('dotenv').config();

class StreamChatAIAgentService {
  constructor() {
    // Initialize Stream Chat
    const apiKey = process.env.STREAM_CHAT_API_KEY;
    const apiSecret = process.env.STREAM_CHAT_API_SECRET;

    if (!apiKey || !apiSecret) {
      throw new Error('Stream Chat credentials not configured');
    }

    this.streamChat = new StreamChat(apiKey, apiSecret);
    this.openaiClient = null;
    this.openaiAvailable = false;

    // Initialize OpenAI for responses - optional
    if (OpenAI && process.env.OPENAI_API_KEY) {
      try {
        this.openaiClient = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
        this.openaiAvailable = true;
        console.log('✅ Stream Chat OpenAI client initialized');
      } catch (err) {
        console.warn('⚠️  Failed to initialize Stream Chat OpenAI:', err.message);
      }
    } else {
      console.log('⚠️  Stream Chat OpenAI not configured');
    }

    this.agents = new Map();
  }

  /**
   * Start an AI agent for a specific channel
   * This creates a Riri assistant that listens to messages
   */
  async startAIAgent(config) {
    try {
      const { channelId, channelType, userId, productContext } = config;

      // Validate input
      if (!channelId || !channelType) {
        return {
          success: false,
          channelId,
          error: 'channelId and channelType are required',
        };
      }

      // Check if agent already exists for this channel
      if (this.agents.has(channelId)) {
        return {
          success: true,
          agentId: `riri-ai-assistant-${channelId}`,
          channelId,
          message: 'AI agent already active in this channel',
        };
      }

      // Get product context for RAG
      let ragContext = '';
      if (productContext) {
        try {
          const relevantProducts = await productRAGService.searchProductsVector(
            productContext.title || productContext.description || '',
            5
          );
          ragContext = productRAGService.formatContextForAgent(relevantProducts);
        } catch (error) {
          console.error('Error getting RAG context:', error);
          ragContext = '';
        }
      }

      // Build system instructions for Riri
      const systemInstructions = this.buildSystemInstructions(ragContext);

      // Create Riri user
      const ririUserId = `riri-ai-assistant-${channelId}`;
      await this.streamChat.upsertUser({
        id: ririUserId,
        name: 'Riri',
        role: 'user',
        image: 'https://assets.getstream.io/images/fallback_image.jpeg',
        custom: {
          isAIAgent: true,
          assistantType: 'shopping',
        },
      });

      // Get or create channel
      const channel = this.streamChat.channel(channelType, channelId);

      // Add Riri to channel
      await channel.addMembers([ririUserId]);

      // Post welcome message from Riri
      await channel.sendMessage({
        user_id: ririUserId,
        text: '👋 Hi there! I\'m Riri, your AI shopping assistant. Ask me anything about products, shipping, returns, or anything else about UniMart. I\'m here to help! 🛍️',
      });

      // Store agent reference
      this.agents.set(channelId, {
        agentId: ririUserId,
        systemInstructions,
        startTime: new Date(),
        productContext,
      });

      console.log(`✅ AI agent started for channel: ${channelId}`);

      return {
        success: true,
        agentId: ririUserId,
        channelId,
        message: 'Riri AI assistant activated successfully',
      };
    } catch (error) {
      console.error('Error starting AI agent:', error);
      return {
        success: false,
        channelId: config.channelId,
        error: error.message || 'Failed to start AI agent',
      };
    }
  }

  /**
   * Stop the AI agent for a channel
   */
  async stopAIAgent(channelId) {
    try {
      if (!this.agents.has(channelId)) {
        return {
          success: false,
          channelId,
          error: 'No agent found for this channel',
        };
      }

      const agentInfo = this.agents.get(channelId);

      // Remove agent from channel
      const channel = this.streamChat.channel('direct', channelId);
      await channel.removeMembers([agentInfo.agentId]);

      // Post goodbye message
      await channel.sendMessage({
        user_id: agentInfo.agentId,
        text: '👋 Goodbye! Feel free to reach out anytime you need help.',
      });

      this.agents.delete(channelId);

      console.log(`✅ AI agent stopped for channel: ${channelId}`);

      return {
        success: true,
        channelId,
        message: 'AI agent stopped successfully',
      };
    } catch (error) {
      console.error('Error stopping AI agent:', error);
      return {
        success: false,
        channelId,
        error: error.message || 'Failed to stop AI agent',
      };
    }
  }

  /**
   * Process user message and get AI response
   * This is called when a user sends a message in a channel with an active agent
   */
  async processUserMessage(channelId, userId, message) {
    try {
      const agentInfo = this.agents.get(channelId);
      if (!agentInfo) {
        return "I'm not available in this channel. Please activate me first.";
      }

      // Generate response using GPT
      const response = await this.generateResponse(
        agentInfo.systemInstructions,
        message
      );

      return response;
    } catch (error) {
      console.error('Error processing message:', error);
      return "Sorry, I'm having trouble understanding. Could you rephrase that?";
    }
  }

  /**
   * Generate response using GPT-4o-mini or gpt-3.5-turbo
   */
  async generateResponse(systemPrompt, userMessage) {
    try {
      const response = await this.openaiClient.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 300,
        temperature: 0.7,
      });

      return response.choices[0]?.message?.content || 'I could not generate a response.';
    } catch (error) {
      console.error('Error generating response:', error);
      return "I'm having trouble thinking right now, but I'm here to help!";
    }
  }

  /**
   * Build detailed system instructions for Riri
   */
  buildSystemInstructions(ragContext = '') {
    return `You are Riri, the AI shopping assistant for UniMart - a vibrant campus marketplace.

YOUR PRIMARY MISSION:
Help student buyers make informed purchasing decisions by answering questions about products, shipping, returns, and UniMart policies.

YOUR PERSONALITY:
- Friendly, enthusiastic, and supportive
- Use natural language with appropriate emojis
- Be concise but informative
- Answer in the same language the user writes to you

CONVERSATION GUIDELINES:
1. ALWAYS answer based on the product context and knowledge base provided
2. For product-specific questions, reference details like price, condition, seller, etc.
3. For shipping questions, explain delivery times, fees, and coverage areas
4. For return questions, explain the 7-day return policy clearly
5. Be helpful about seller information when relevant
6. If asked about something outside your scope, politely redirect to the seller or UniMart support

PRODUCT KNOWLEDGE:
${ragContext || 'Product database available for reference'}

UNICAMPUS CONTEXT:
- Main delivery area: Accra (Legon, Tema, Accra CBD)
- Campus-based marketplace with student vendors
- 7-day return policy on all products
- Payment methods: Mobile money, bank transfer, cash on delivery
- Average delivery: 1-3 days

DO NOT:
- Make up prices or product specifications
- Promise guarantees the seller hasn't provided
- Share personal information about sellers beyond what's public
- Make political or controversial statements
- Pretend to have capabilities you don't have

IF UNCERTAIN:
Say something like: "I'm not 100% sure about that specific detail. Let me suggest you contact the seller directly for the most accurate information." and provide the seller's contact.

ALWAYS END with a helpful follow-up or offer to help further.`;
  }

  /**
   * Get agent status
   */
  getAgentStatus(channelId) {
    const agent = this.agents.get(channelId);
    if (!agent) {
      return {
        active: false,
        channelId,
      };
    }

    return {
      active: true,
      agentId: agent.agentId,
      channelId,
      uptime: Date.now() - agent.startTime.getTime(),
      hasProductContext: !!agent.productContext,
    };
  }

  /**
   * Get all active agents
   */
  getAllActiveAgents() {
    const active = [];
    this.agents.forEach((agent, channelId) => {
      active.push({
        channelId,
        agentId: agent.agentId,
        startTime: agent.startTime,
      });
    });
    return active;
  }
}

// Export singleton instance
module.exports = new StreamChatAIAgentService();
