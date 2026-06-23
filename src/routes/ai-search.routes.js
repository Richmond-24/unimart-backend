// routes/ai-search.routes.js
const express = require('express');
const router = express.Router();

const PYTHON_SEARCH_URL = process.env.PYTHON_SEARCH_URL || 'http://localhost:5001/search';

router.post('/ai-search', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Invalid query' });
    }
    const response = await fetch(PYTHON_SEARCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, top_k: 20 }),
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Search proxy error:', error);
    res.status(503).json({ error: 'Search service unavailable' });
  }
});

module.exports = router;