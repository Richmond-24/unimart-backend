/**
 * Riri AI Chat - Complete Implementation Guide
 * RAG + OpenRouter Integration for Campus Marketplace
 */

// ========== SETUP INSTRUCTIONS ==========

/**
 * 1. INSTALL DEPENDENCIES

curl -X POST https://unimart-backends.onrender.com/api/riri/chat \
 * 
 * (should already be installed in your project)
 */

// ========== ENVIRONMENT SETUP ==========

/**
 * 2. SET UP ENVIRONMENT VARIABLES
 * 
 * Copy the .env.example file and create .env:
 * 
 *   cp .env.example .env
 * 
 * Add your OpenRouter API key:
 * 
 *   OPENROUTER_API_KEY=your-api-key
 *   LLM_PROVIDER=openrouter
 *   LLM_MODEL=meta-llama/llama-3.2-3b-instruct:free
 * 
 * Get free key: https://openrouter.ai
 */

// ========== BACKEND CODE STRUCTURE ==========

/**
 * 3. FILE STRUCTURE (already created/updated)
 * 
 *   src/
 *   ├── models/
 *   │   └── RiriChat.model.js          ← Conversation storage
 *   ├── controllers/
 *   │   └── riri.controller.js         ← Chat logic (already has chat endpoint)
 *   ├── services/
 *   │   ├── llm.service.js             ← OpenRouter/OpenAI/Ollama integration (UPDATED)
 *   │   ├── rag.service.js             ← Product/Service retrieval (existing)
 *   │   └── productRAG.service.js      ← Product search helper
 *   └── routes/
 *       └── riri.routes.js             ← Chat endpoints (already set up)
 * 
 * POST /api/riri/chat        ← Main endpoint (protected)
 * POST /api/riri/feedback    ← Feedback endpoint
 * GET  /api/riri/history     ← Get chat history
 */

// ========== COMPLETE API INTEGRATION ==========

/**
 * ENDPOINT: POST /api/riri/chat
 * 
 * REQUEST:
 * {
 *   "message": "Can you recommend a laptop within 2000 cedis?",
 *   "conversationId": "conv-123456",  // optional, auto-generated if not provided
 *   "platform": "ios",                 // optional
 *   "appVersion": "1.0.0"              // optional
 * }
 * 
 * RESPONSE:
 * {
 *   "success": true,
 *   "data": {
 *     "conversationId": "conv-123456",
 *     "response": "I found several laptops within your budget! Here are the top options:\n\n- Dell Inspiron: ₵1,850 | Great for students\n- HP Pavilion: ₵1,950 | Excellent performance\n\nAll items are verified and ready for purchase. Would you like more details on any of these?",
 *     "ragContext": {
 *       "productsFound": 2,
 *       "servicesFound": 0,
 *       "foodFound": 0
 *     },
 *     "tokens": {
 *       "prompt": 234,
 *       "completion": 102,
 *       "total": 336
 *     },
 *     "model": "meta-llama/llama-3.2-3b-instruct:free",
 *     "chatId": "607f1f77bcf86cd799439011",
 *     "feedbackRequired": false
 *   },
 *   "message": "Response generated successfully"
 * }
 */

// ========== HOW IT WORKS ==========

/**
 * STEP-BY-STEP FLOW:
 * 
 * 1. Frontend sends user message to /api/riri/chat
 * 2. Backend validates message
 * 3. RAG Service:
 *    - Searches MongoDB for relevant products
 *    - Searches for relevant services
 *    - Searches for relevant food listings
 *    - Returns matches ranked by relevance
 * 4. Context Building:
 *    - Formats retrieved items into readable text
 *    - Includes prices, categories, descriptions
 * 5. LLM Call:
 *    - Sends user message + RAG context to OpenRouter
 *    - OpenRouter routes to selected free model (Llama, Mistral, etc.)
 *    - Returns AI-generated response
 * 6. Database Save:
 *    - Stores conversation in RiriChat collection
 *    - Saves RAG context for future learning
 * 7. Response:
 *    - Returns response text + metadata to frontend
 */

// ========== DATABASE QUERIES INVOLVED ==========

/**
 * RiriChat schema stores:
 * - userId: Who asked the question
 * - conversationId: Groups related messages
 * - messages: All user/assistant messages in conversation
 * - currentResponse: Latest LLM response
 * - ragContext.queriedProducts: Retrieved products
 * - ragContext.queriedServices: Retrieved services
 * - feedback: User rating/comment on response
 * - isUnansweredQuestion: Flag if response was unhelpful
 */

// ========== EXAMPLE QUERIES RIG PERFORMS ==========

/**
 * 1. PRODUCT SEARCH:
 *    db.products.find({
 *      isActive: true,
 *      status: "approved",
 *      $or: [
 *        { name: /laptop/i },
 *        { description: /laptop/i }
 *      ]
 *    }).select('_id name description price category').limit(5)
 * 
 * 2. SERVICE SEARCH:
 *    db.services.find({
 *      isActive: true,
 *      $or: [
 *        { name: /tutor/i },
 *        { description: /tutor/i }
 *      ]
 *    }).select('_id name description provider price').limit(3)
 * 
 * 3. FOOD SEARCH:
 *    db.foods.find({
 *      isActive: true,
 *      $or: [
 *        { name: /pizza/i },
 *        { description: /pizza/i }
 *      ]
 *    }).select('_id name description price vendor').limit(3)
 * 
 * 4. SAVE CONVERSATION:
 *    db.ririchats.insertOne({
 *      userId, conversationId, messages,
 *      currentResponse, ragContext, metadata
 *    })
 */

// ========== TESTING ==========

/**
 * CURL Example:
 * 
 * curl -X POST https://unimart-backends.onrender.com/api/riri/chat \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "message": "What laptops do you have?",
 *     "conversationId": "test-conv-1",
 *     "platform": "ios"
 *   }'
 */

// ========== ERROR HANDLING ==========

/**
 * Fallback scenarios:
 * 
 * 1. No products found:
 *    → RAG returns empty array
 *    → LLM handles gracefully: "I couldn't find any laptops matching that. Try 'budget laptops' or 'gaming laptops'?"
 * 
 * 2. OpenRouter API down:
 *    → catches error, logs it
 *    → returns fallback response: "I'm having trouble thinking right now, but I'm here to help!"
 * 
 * 3. Rate limited:
 *    → OpenRouter returns 429
 *    → Error logged, user gets fallback message
 * 
 * 4. Invalid API key:
 *    → Returns 401 Unauthorized from OpenRouter
 *    → Check OPENROUTER_API_KEY in .env
 */

// ========== FREE TIER NOTES ==========

/**
 * OpenRouter Free Models:
 * 
 * meta-llama/llama-3.2-3b-instruct:free
 * - 3B parameter model
 * - Fast responses (~2-5 seconds)
 * - Good for basic Q&A
 * - No cost
 * 
 * mistralai/mistral-7b-instruct:free
 * - 7B parameter model
 * - Better reasoning than Llama
 * - Slightly slower
 * - No cost
 * 
 * For production quality, upgrade to paid:
 * - openai/gpt-4o-mini (~$0.0002 per 1K tokens)
 * - openai/gpt-4-turbo (~$0.001 per 1K tokens)
 */

// ========== MONITORING & ANALYTICS ==========

/**
 * Track in RiriChat:
 * - isUnansweredQuestion: true if user rated response as unhelpful
 * - feedback.rating: 1-5 star rating
 * - feedback.status: 'helpful', 'not_helpful', 'needs_improvement'
 * - tokens: Track API usage
 */

// ========== NEXT STEPS ==========

/**
 * 1. Get OpenRouter API key from https://openrouter.ai
 * 2. Add to .env: OPENROUTER_API_KEY=your-key
 * 3. Set LLM_PROVIDER=openrouter and LLM_MODEL=meta-llama/llama-3.2-3b-instruct:free
 * 4. Test with curl command above
 * 5. Integrate frontend (see FRONTEND_INTEGRATION.md)
 * 6. Monitor responses in RiriChat collection
 * 7. Collect feedback and iterate on prompts
 */

module.exports = {
  documentation: `
    Riri AI Chat is now fully integrated with OpenRouter.
    See this file for complete setup and integration details.
  `,
};
