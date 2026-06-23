// backend/src/routes/search-enhanced.js
const express = require('express');
const router = express.Router();
const Listing = require('../models/Listing'); // Use Listing model
const mongoose = require('mongoose');

/**
 * @route GET /api/search/products
 * @desc Search products with filters and pagination
 * @query q: search query string
 * @query category: product category
 * @query minPrice: minimum price
 * @query maxPrice: maximum price
 * @query sort: sort by 'price', 'rating', 'newest', 'popular'
 * @query limit: number of results (default 20)
 * @query page: page number (default 1)
 */
router.get('/products', async (req, res) => {
  try {
    const { q, category, minPrice, maxPrice, sort = 'popular', limit = 20, page = 1 } = req.query;

    // Build filter object
    const filter = { status: 'active' };

    // Text search
    if (q && q.trim()) {
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } },
      ];
    }

    // Category filter
    if (category) {
      filter.category = { $regex: category, $options: 'i' };
    }

    // Price filter
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    // Sort options
    let sortObj = {};
    switch (sort) {
      case 'price_asc':
        sortObj = { price: 1 };
        break;
      case 'price_desc':
        sortObj = { price: -1 };
        break;
      case 'rating':
        sortObj = { rating: -1 };
        break;
      case 'newest':
        sortObj = { createdAt: -1 };
        break;
      case 'popular':
      default:
        sortObj = { sales: -1, rating: -1 };
    }

    // Pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    // Execute query
    const products = await Listing.find(filter)
      .sort(sortObj)
      .limit(limitNum)
      .skip(skip)
      .lean();

    // Get total count
    const total = await Listing.countDocuments(filter);

    res.json({
      success: true,
      data: products,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('🔴 Search error:', error);
    res.status(500).json({ success: false, error: 'Search failed' });
  }
});

/**
 * @route GET /api/search/suggestions
 * @desc Get search suggestions based on partial query
 * @query q: search query string
 */
router.get('/suggestions', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 1) {
      return res.json({ success: true, data: [] });
    }

    // Get unique product titles matching the query
    const suggestions = await Listing.find(
      {
        $or: [
          { title: { $regex: q, $options: 'i' } },
          { category: { $regex: q, $options: 'i' } },
        ],
        status: 'active',
      },
      { title: 1 }
    )
      .limit(8)
      .lean();

    const titles = [...new Set(suggestions.map((p) => p.title))];

    res.json({ success: true, data: titles });
  } catch (error) {
    console.error('🔴 Suggestions error:', error);
    res.status(500).json({ success: false, error: 'Failed to get suggestions' });
  }
});

/**
 * @route GET /api/search/trending
 * @desc Get trending/popular searches
 */
router.get('/trending', async (req, res) => {
  try {
    // Get most popular products (can be based on sales, views, rating, etc)
    const trending = await Listing.find({ status: 'active' })
      .sort({ sales: -1, rating: -1 })
      .limit(6)
      .select('title category')
      .lean();

    // Extract categories as trending searches
    const categories = [...new Set(trending.map((p) => p.category))].slice(0, 6);

    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('🔴 Trending error:', error);
    res.status(500).json({ success: false, error: 'Failed to get trending' });
  }
});

/**
 * @route POST /api/search/query-log (optional - for analytics)
 * @desc Log search queries for analytics
 */
router.post('/query-log', async (req, res) => {
  try {
    const { query, userId } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query required' });
    }

    // You can save this to a SearchLog collection if needed
    console.log(`📊 Search logged: "${query}" by user ${userId || 'guest'}`);

    res.json({ success: true });
  } catch (error) {
    console.error('🔴 Query log error:', error);
    // Don't fail the search if logging fails
    res.json({ success: true });
  }
});

module.exports = router;
