/**
 * Stream Chat AI Agent Routes (CommonJS)
 * Endpoints for managing AI agents in Stream Chat channels
 */

const express = require('express');
const productRAGService = require('../services/productRAG.service');
const streamChatAIAgentService = require('../services/streamChatAIAgent.service');
const router = express.Router();

/**
 * POST /api/ai-agent/start
 * Start an AI agent (Riri) in a specific channel
 */
router.post('/start', async (req, res) => {
  try {
    const { channelId, channelType, userId, productContext } = req.body;

    // Validation
    if (!channelId || !channelType) {
      return res.status(400).json({
        success: false,
        error: 'channelId and channelType are required',
      });
    }

    // Start AI agent
    const result = await streamChatAIAgentService.startAIAgent({
      channelId,
      channelType,
      userId,
      productContext,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    console.log(`✅ AI agent started for channel ${channelId}`);

    return res.status(200).json({
      success: true,
      agentId: result.agentId,
      channelId: result.channelId,
      message: result.message,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in /start endpoint:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to start AI agent',
      details: error.message,
    });
  }
});

/**
 * POST /api/ai-agent/stop
 * Stop an AI agent in a specific channel
 */
router.post('/stop', async (req, res) => {
  try {
    const { channelId } = req.body;

    if (!channelId) {
      return res.status(400).json({
        success: false,
        error: 'channelId is required',
      });
    }

    const result = await streamChatAIAgentService.stopAIAgent(channelId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    console.log(`✅ AI agent stopped for channel ${channelId}`);

    return res.status(200).json({
      success: true,
      message: result.message,
      channelId: result.channelId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in /stop endpoint:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to stop AI agent',
      details: error.message,
    });
  }
});

/**
 * GET /api/ai-agent/status/:channelId
 * Get status of AI agent in a channel
 */
router.get('/status/:channelId', (req, res) => {
  try {
    const { channelId } = req.params;

    const status = streamChatAIAgentService.getAgentStatus(channelId);

    return res.status(200).json({
      ...status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in /status endpoint:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get agent status',
      details: error.message,
    });
  }
});

/**
 * GET /api/ai-agent/active
 * Get all active AI agents
 */
router.get('/active', (req, res) => {
  try {
    const agents = streamChatAIAgentService.getAllActiveAgents();

    return res.status(200).json({
      agents,
      count: agents.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in /active endpoint:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get active agents',
      details: error.message,
    });
  }
});

/**
 * POST /api/ai-agent/message
 * Send a message and get AI response
 */
router.post('/message', async (req, res) => {
  try {
    const { channelId, userId, message } = req.body;

    if (!channelId || !userId || !message) {
      return res.status(400).json({
        success: false,
        error: 'channelId, userId, and message are required',
      });
    }

    const response = await streamChatAIAgentService.processUserMessage(
      channelId,
      userId,
      message
    );

    return res.status(200).json({
      success: true,
      response,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in /message endpoint:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process message',
      details: error.message,
    });
  }
});

/**
 * POST /api/ai-agent/search
 * Search products for RAG context
 */
router.post('/search', async (req, res) => {
  try {
    const { query, limit = 5 } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'query is required',
      });
    }

    const products = await productRAGService.searchProductsVector(query, limit);

    return res.status(200).json({
      success: true,
      products,
      count: products.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in /search endpoint:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to search products',
      details: error.message,
    });
  }
});

/**
 * GET /api/ai-agent/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'AI Agent service is healthy',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
