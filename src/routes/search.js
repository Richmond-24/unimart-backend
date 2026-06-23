// backend/routes/search.js
const express = require('express');
const router = express.Router();
const Listing = require('../models/Listing');
const { callOpenRouter } = require('../utils/openrouter');

// Helper: interpret natural language query
async function interpretQuery(query) {
  const prompt = `You are a search assistant. Extract search intent from: "${query}"
Return JSON: { "keywords": string[], "category": string|null, "price_min": number|null, "price_max": number|null, "condition": string|null }`;
  const response = await callOpenRouter({
    model: 'google/gemini-pro',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 200,
    temperature: 0.2,
  });
  const content = response.choices[0].message.content;
  const match = content.match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : { keywords: [] };
}

router.post('/ai', async (req, res) => {
  const { q } = req.body;
  if (!q) return res.status(400).json({ error: 'Query required' });

  try {
    const { keywords, category, price_min, price_max, condition } = await interpretQuery(q);
    const filter = { status: 'active' };
    if (keywords?.length) {
      filter.$or = [{ title: { $regex: keywords.join('|'), $options: 'i' } },
                    { description: { $regex: keywords.join('|'), $options: 'i' } }];
    }
    if (category) filter.category = category;
    if (price_min) filter.price = { $gte: price_min };
    if (price_max) filter.price = { ...filter.price, $lte: price_max };
    if (condition) filter.condition = condition;

    const products = await Listing.find(filter).limit(20);
    res.json({ success: true, data: products.map(p => normalizeDoc(p)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;