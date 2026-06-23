const mongoose = require('mongoose');

/**
 * Riri Chat History & Feedback Schema
 * Stores all chat messages, LLM responses, and user feedback for continuous learning
 */
const RiriChatSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    conversationId: {
      type: String,
      required: true,
      index: true, // Group messages by conversation
    },
    messages: [
      {
        _id: false,
        role: {
          type: String,
          enum: ['user', 'assistant'],
          required: true,
        },
        content: {
          type: String,
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    currentResponse: {
      text: String,
      tokens: {
        prompt: Number,
        completion: Number,
        total: Number,
      },
      model: String, // "gpt-4o-mini" or "ollama:mistral" etc.
      generatedAt: Date,
    },
    feedback: {
      status: {
        type: String,
        enum: [null, 'helpful', 'not_helpful', 'needs_improvement'],
        default: null,
      },
      rating: {
        type: Number,
        min: 1,
        max: 5,
      },
      comment: String,
      feedbackAt: Date,
    },
    userContext: {
      cartItems: [
        {
          productId: mongoose.Schema.Types.ObjectId,
          name: String,
          price: Number,
        },
      ],
      savedItems: [mongoose.Schema.Types.ObjectId],
      location: {
        campus: String,
        hostel: String,
      },
      preferences: {
        categories: [String],
        priceRange: {
          min: Number,
          max: Number,
        },
      },
    },
    ragContext: {
      queriedProducts: [
        {
          _id: false,
          productId: mongoose.Schema.Types.ObjectId,
          name: String,
          price: Number,
          category: String,
          relevanceScore: Number,
        },
      ],
      queriedServices: [
        {
          _id: false,
          serviceId: mongoose.Schema.Types.ObjectId,
          name: String,
          provider: String,
          category: String,
          relevanceScore: Number,
        },
      ],
    },
    isUnansweredQuestion: {
      type: Boolean,
      default: false,
      index: true,
    },
    reason: {
      type: String,
      enum: [null, 'llm_no_answer', 'rag_no_data', 'user_negative_feedback'],
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'archived', 'reviewed'],
      default: 'active',
    },
    metadata: {
      userAgent: String,
      platform: String, // 'ios', 'android', 'web'
      appVersion: String,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Indexes for efficient queries
RiriChatSchema.index({ userId: 1, createdAt: -1 });
RiriChatSchema.index({ isUnansweredQuestion: 1, createdAt: -1 });
RiriChatSchema.index({ 'feedback.status': 1, createdAt: -1 });

module.exports = mongoose.model('RiriChat', RiriChatSchema);
