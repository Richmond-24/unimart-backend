// backend/routes/assistant.js
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Listing = require('../models/Listing'); // adjust path if needed
const { callOpenRouter } = require('../utils/openrouter');

// Helper: classify intent using OpenRouter
async function classifyIntent(message, productContext = null) {
  const prompt = `You are an e‑commerce assistant for Uni‑Mart. Classify the user's intent into one of these categories:
- "product_search": user is looking for products (e.g., "show me sneakers", "find textbooks under 50")
- "add_to_cart": user wants to add a specific product to cart (e.g., "add the Nike shoes to my cart")
- "track_order": user asks about an order status (e.g., "where is my order?", "track order #123")
- "general_question": any other question (e.g., "how does delivery work?", "what's your return policy?")

Extract relevant entities:
- product: name of the product (if any)
- category: category (if any)
- price_max: maximum price (if any)
- orderId: order ID (if any)

Return ONLY valid JSON with fields: intent, entities.

User message: "${message}"
${productContext ? `Current product context: ${JSON.stringify(productContext)}` : ''}`;

  const response = await callOpenRouter({
    model: 'google/gemini-pro',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 200,
    temperature: 0.2,
  });

  const content = response.choices[0].message.content;
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  } else {
    console.error('Failed to parse intent:', content);
    return { intent: 'general_question', entities: {} };
  }
}

// Simple product search using MongoDB text search (or regex fallback)
async function searchProducts(query, limit = 5) {
  const regex = new RegExp(query, 'i');
  const products = await Listing.find({
    status: 'active',
    $or: [{ title: regex }, { description: regex }, { tags: regex }]
  }).limit(limit);
  return products.map(p => ({
    id: p._id,
    title: p.title,
    price: p.price,
    image: p.imageUrls?.[0] || p.image,
    condition: p.condition,
    brand: p.brand,
  }));
}

// Placeholder for order tracking (you can later replace with actual DB query)
async function trackOrder(orderId, userId) {
  // Mock response – replace with your real order lookup
  return {
    status: 'processing',
    estimatedDelivery: '2-3 business days',
    message: `Order #${orderId} is being processed. We'll update you when it ships.`
  };
}

router.post('/', async (req, res) => {
  try {
    const { message, userId, productContext } = req.body;
    if (!message || !userId) {
      return res.status(400).json({ error: 'Missing message or userId' });
    }

    // 1. Classify intent
    const { intent, entities } = await classifyIntent(message, productContext);
    console.log(`Intent: ${intent}, Entities:`, entities);

    // 2. Handle based on intent
    if (intent === 'product_search') {
      const query = entities.product || message;
      const products = await searchProducts(query);
      return res.json({
        type: 'product_list',
        data: { products },
        reply: `Here are some products matching "${query}":`
      });
    }
    else if (intent === 'add_to_cart') {
      // If we have a product name, try to find it
      if (entities.product) {
        const product = await Listing.findOne({
          title: { $regex: new RegExp(entities.product, 'i') },
          status: 'active'
        });
        if (product) {
          return res.json({
            type: 'action',
            data: { action: 'add_to_cart', productId: product._id, productName: product.title }
          });
        }
      }
      // If we couldn't find, ask for clarification
      return res.json({
        type: 'question',
        data: { question: 'Which product would you like to add to your cart? Please provide the product name.' }
      });
    }
    else if (intent === 'track_order') {
      const orderId = entities.orderId;
      if (!orderId) {
        return res.json({
          type: 'question',
          data: { question: 'Please provide your order number.' }
        });
      }
      const orderStatus = await trackOrder(orderId, userId);
      return res.json({
        type: 'order_status',
        data: orderStatus
      });
    }
    else {
      // General question – answer with OpenRouter
      const prompt = `You are RIRI, the AI assistant for Uni‑Mart. Answer the user's question helpfully and concisely.
${productContext ? `Current product context: ${JSON.stringify(productContext)}` : ''}
User: ${message}`;
      const response = await callOpenRouter({
        model: 'google/gemini-pro',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.7,
      });
      const reply = response.choices[0].message.content;
      return res.json({
        type: 'text',
        data: { text: reply }
      });
    }

  } catch (err) {
    console.error('Assistant error:', err);
    res.status(500).json({ type: 'error', data: { message: 'Something went wrong. Please try again.' } });
  }
});

module.exports = router;