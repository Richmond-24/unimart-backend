/**
 * Riri Chat Controller (Advanced LLM Version)
 * Handles LLM-powered chat with RAG, feedback collection, and learning
 */

const mongoose = require('mongoose');
const RiriChat = require('../models/RiriChat.model');
const ragService = require('../services/rag.service');
const llmService = require('../services/llm.service');

/**
 * POST /api/riri/chat
 * Main chat endpoint - accepts user message and returns AI response
 */
exports.chat = async (req, res) => {
  try {
    const userId = req.user.id;
    const { message, conversationId, conversationHistory = [] } = req.body;

    // Validation
    if (!message || typeof message !== 'string' || message.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot be empty',
      });
    }

    if (message.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Message too long (max 1000 characters)',
      });
    }

    // Convert conversation history to proper format
    const formattedHistory = conversationHistory.map((msg) => ({
      role: msg.role || (msg.sender === 'user' ? 'user' : 'assistant'),
      content: msg.content || msg.text,
    }));

    // Get user context for personalization
    const userContext = await ragService.getUserContext(userId);

    // Search for relevant products, services, foods (RAG)
    const [products, services, foods] = await Promise.all([
      ragService.searchProducts(message, 5),
      ragService.searchServices(message, 3),
      ragService.searchFood(message, 3),
    ]);

    // Build RAG context
    const ragContext = llmService.formatRAGContext(products, services, foods);

    // Build system prompt
    const systemPrompt = llmService.buildSystemPrompt(userContext);

    // Generate LLM response
    let llmResult;
    try {
      llmResult = await llmService.generateResponse(
        systemPrompt,
        message,
        formattedHistory,
        ragContext
      );
    } catch (llmError) {
      console.error('LLM Error:', llmError.message);
      // Fallback response
      llmResult = {
        text: "I'm having trouble thinking right now, but I'm here to help! Try asking about specific products, services, food, or events. 🛍️",
        tokens: { prompt: 0, completion: 0, total: 0 },
        model: llmService.model,
        error: llmError.message,
      };
    }

    // Check if LLM couldn't answer
    const couldNotAnswer = llmService._couldNotAnswer(llmResult.text);

    // Save to database for learning
    const chatDoc = new RiriChat({
      userId,
      conversationId: conversationId || new mongoose.Types.ObjectId(),
      messages: [
        ...formattedHistory.map((msg) => ({
          role: msg.role,
          content: msg.content,
          timestamp: new Date(),
        })),
        {
          role: 'user',
          content: message,
          timestamp: new Date(),
        },
      ],
      currentResponse: {
        text: llmResult.text,
        tokens: llmResult.tokens,
        model: llmResult.model,
        generatedAt: new Date(),
      },
      userContext,
      ragContext: {
        queriedProducts: products,
        queriedServices: services,
      },
      isUnansweredQuestion: couldNotAnswer,
      reason: couldNotAnswer ? 'llm_no_answer' : null,
      status: 'active',
      metadata: {
        userAgent: req.headers['user-agent'],
        platform: req.body.platform || 'unknown',
        appVersion: req.body.appVersion || 'unknown',
      },
    });

    await chatDoc.save();

    // Response with feedback instructions
    return res.status(200).json({
      success: true,
      data: {
        conversationId: chatDoc.conversationId,
        response: llmResult.text,
        ragContext: {
          productsFound: products.length,
          servicesFound: services.length,
          foodFound: foods.length,
        },
        // Return lightweight matched items for frontend suggestions (id, title, price, image, url)
        matches: {
          products: (products || []).slice(0, 5).map((p) => ({
            id: p._id || p.id,
            title: p.title || p.productName || 'Product',
            price: p.price ?? null,
            image: (p.imageUrls && p.imageUrls.length) ? p.imageUrls[0] : null,
            url: `/listings/${p._id || p.id}`,
          })),
          services: (services || []).slice(0, 5).map((s) => ({
            id: s._id || s.id,
            title: s.title || s.name || 'Service',
            price: s.price ?? null,
            image: (s.imageUrls && s.imageUrls.length) ? s.imageUrls[0] : null,
            url: `/services/${s._id || s.id}`,
          })),
        },
        // Indicate when the assistant could not provide a confident answer
        noAnswer: couldNotAnswer,
        tokens: llmResult.tokens,
        model: llmResult.model,
        chatId: chatDoc._id,
        feedbackRequired: couldNotAnswer, // Prompt frontend to ask for feedback
      },
      message: 'Response generated successfully',
    });
  } catch (error) {
    console.error('❌ Riri chat error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error generating response',
    });
  }
};

/**
 * POST /api/riri/feedback
 * Submit feedback on a Riri response
 */
exports.submitFeedback = async (req, res) => {
  try {
    const userId = req.user.id;
    const { chatId, rating, status, comment } = req.body;

    if (!chatId) {
      return res.status(400).json({
        success: false,
        message: 'Chat ID is required',
      });
    }

    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5',
      });
    }

    const validStatuses = ['helpful', 'not_helpful', 'needs_improvement'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid feedback status',
      });
    }

    // Update chat feedback
    const chatDoc = await RiriChat.findByIdAndUpdate(
      chatId,
      {
        feedback: {
          status: status || null,
          rating: rating || null,
          comment: comment || null,
          feedbackAt: new Date(),
        },
        isUnansweredQuestion: status === 'not_helpful' ? true : false,
        reason: status === 'not_helpful' ? 'user_negative_feedback' : null,
      },
      { new: true }
    );

    if (!chatDoc) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found',
      });
    }

    // Log feedback for analytics
    console.log('📊 Riri Feedback:', {
      chatId,
      userId,
      rating,
      status,
      comment,
      timestamp: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: 'Feedback submitted successfully',
      data: chatDoc,
    });
  } catch (error) {
    console.error('❌ Feedback error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error submitting feedback',
    });
  }
};

/**
 * GET /api/riri/history
 * Get chat history for a user
 */
exports.getHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, skip = 0 } = req.query;

    const chats = await RiriChat.find({ userId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .select('-ragContext.queriedProducts -ragContext.queriedServices');

    const total = await RiriChat.countDocuments({ userId });

    return res.status(200).json({
      success: true,
      data: {
        chats,
        total,
        pagination: {
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: parseInt(skip) + parseInt(limit) < total,
        },
      },
    });
  } catch (error) {
    console.error('❌ History error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error fetching history',
    });
  }
};

/**
 * DELETE /api/riri/history
 * Clear chat history
 */
exports.clearHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    await RiriChat.updateMany({ userId }, { status: 'archived' });

    return res.status(200).json({
      success: true,
      message: 'Chat history cleared',
    });
  } catch (error) {
    console.error('❌ Clear history error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error clearing history',
    });
  }
};

/**
 * GET /api/riri/unanswered-questions (Admin only)
 * Retrieve questions that couldn't be answered for training
 */
exports.getUnansweredQuestions = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized - admin access required',
      });
    }

    const { limit = 100, skip = 0 } = req.query;

    const questions = await RiriChat.find({ isUnansweredQuestion: true })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .select('userId conversationId messages currentResponse feedback reason createdAt');

    const total = await RiriChat.countDocuments({ isUnansweredQuestion: true });

    return res.status(200).json({
      success: true,
      data: {
        questions,
        total,
        pagination: {
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: parseInt(skip) + parseInt(limit) < total,
        },
      },
    });
  } catch (error) {
    console.error('❌ Unanswered questions error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error fetching unanswered questions',
    });
  }
};

/**
 * GET /api/riri/analytics (Admin only)
 * Get Riri statistics and performance metrics
 */
exports.getAnalytics = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized - admin access required',
      });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get statistics
    const [
      totalChats,
      chatsWith5StarRating,
      chatsWithNegativeFeedback,
      unansweredCount,
      uniqueUsers,
      averageTokensPerChat,
    ] = await Promise.all([
      RiriChat.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      RiriChat.countDocuments({
        'feedback.rating': 5,
        createdAt: { $gte: thirtyDaysAgo },
      }),
      RiriChat.countDocuments({
        'feedback.status': 'not_helpful',
        createdAt: { $gte: thirtyDaysAgo },
      }),
      RiriChat.countDocuments({
        isUnansweredQuestion: true,
        createdAt: { $gte: thirtyDaysAgo },
      }),
      RiriChat.distinct('userId', { createdAt: { $gte: thirtyDaysAgo } }),
      RiriChat.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: null,
            avgTokens: { $avg: '$currentResponse.tokens.total' },
          },
        },
      ]),
    ]);

    // Calculate satisfaction rate
    const satisfactionRate =
      totalChats > 0
        ? ((chatsWith5StarRating / totalChats) * 100).toFixed(2)
        : 0;

    // Calculate answer rate
    const answerRate =
      totalChats > 0
        ? (((totalChats - unansweredCount) / totalChats) * 100).toFixed(2)
        : 0;

    return res.status(200).json({
      success: true,
      data: {
        period: '30 days',
        totalChats,
        uniqueUsers: uniqueUsers.length,
        satisfactionRate: `${satisfactionRate}%`,
        answerRate: `${answerRate}%`,
        unansweredQuestions: unansweredCount,
        avgTokensPerChat: averageTokensPerChat[0]?.avgTokens || 0,
        negativeReviews: chatsWithNegativeFeedback,
      },
    });
  } catch (error) {
    console.error('❌ Analytics error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error fetching analytics',
    });
  }
};

/**
 * POST /api/riri/suggestions (Public)
 * Get quick suggestions for Riri prompts
 */
exports.getSuggestions = async (req, res) => {
  const suggestions = [
    {
      id: 'q1',
      label: '🛍️ Find Laptops',
      query: 'What laptops are available under 500 cedis?',
    },
    {
      id: 'q2',
      label: '🍛 Food Deals',
      query: 'What food is available for delivery right now?',
    },
    {
      id: 'q3',
      label: '📚 Textbooks',
      query: 'Help me find cheap textbooks for my courses',
    },
    {
      id: 'q4',
      label: '👩‍💼 Services',
      query: 'What services are available on campus?',
    },
    {
      id: 'q5',
      label: '🎟️ Events',
      query: 'Any events happening this week?',
    },
    {
      id: 'q6',
      label: '💰 Best Deals',
      query: "What's the best deal you can find for me today?",
    },
  ];

  return res.status(200).json({
    success: true,
    data: suggestions,
  });
};

// ─── Helper: Build contextual response ───────────────────────────────────────
const buildResponse = async (intent, message) => {
  switch (intent) {
    case 'secondhand': {
      const items = await Product.find({ category: 'second-hand', isActive: true })
        .sort('-createdAt').limit(3).select('title price oldPrice discount');
      if (!items.length) return "📚 Browse Second Hand Deals for affordable textbooks from fellow students!";
      const best = items[0];
      return `📚 ${best.title} going for ₵${best.price} (was ₵${best.oldPrice}) — ${best.discount}% off! Check Second Hand Deals for verified student-sold books.`;
    }

    case 'service': {
      const items = await Service.find({ isActive: true }).sort('-rating').limit(3)
        .select('title price rating availability');
      if (!items.length) return "✨ Student services are being listed! Check the Services section soon.";
      const list = items.map(s => `${s.title} from ₵${s.price}`).join(', ');
      return `✨ Top student services: ${list}. All bookable directly in the app!`;
    }

    case 'event': {
      const items = await Event.find({ isActive: true, date: { $gte: new Date() } })
        .sort('date').limit(3).select('title location dateLabel price isFree attending');
      if (!items.length) return "🎉 No upcoming events right now — check back soon or post your own!";
      const list = items.map(e => `${e.title} @ ${e.location} — ${e.isFree ? 'FREE' : `₵${e.price}`}`).join(' | ');
      return `🎉 Upcoming: ${list}. Tap Campus Life to RSVP!`;
    }

    case 'deal': {
      const deals = await FlashDeal.find({ isActive: true, expiresAt: { $gt: new Date() } })
        .sort('expiresAt').limit(3).select('title price oldPrice discount');
      if (!deals.length) return "⚡ No active flash deals right now — check back soon!";
      const list = deals.map(d => `${d.title} ₵${d.price} (${d.discount}% off)`).join(' • ');
      return `⚡ LIVE Flash Deals: ${list}! These expire soon — grab them now in the Flash Deals section!`;
    }

    case 'search': {
      // Extract search terms after common verbs
      const term = message.replace(/find|search|show|get|buy|need|want|looking for/gi, '').trim();
      if (term.length > 2) {
        const results = await Product.find({ $text: { $search: term }, isActive: true })
          .limit(3).select('title price');
        if (results.length) {
          const list = results.map(p => `${p.title} (₵${p.price})`).join(', ');
          return `🔍 Found these for "${term}": ${list}. Tap Search in the app for full results!`;
        }
      }
      return `🔍 I'll help you find that! Use the search bar at the top of the app and type what you're looking for. I can also help with food, services, events, and deals!`;
    }

    default:
      return "👋 I'm RIRI, your UniMart campus assistant! I can help you find products, order food, discover deals, book services, or check events. What do you need?";
  }
};

// @route GET /api/riri/quick-replies
exports.getQuickReplies = async (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 'q1', label: '🛍️ Browse products', reply: "Show me what's trending!" },
      { id: 'q2', label: '🍽️ Order food',        reply: 'What food is available now?' },
      { id: 'q3', label: '📚 Find textbooks',    reply: 'Help me find affordable textbooks.' },
      { id: 'q4', label: '💼 Student services',  reply: 'What services do students offer?' },
      { id: 'q5', label: '🎟️ Campus events',     reply: 'Any events this week?' },
      { id: 'q6', label: '⚡ Flash deals',       reply: "Show me today's best deals!" },
    ],
  });
};
