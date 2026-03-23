
// /home/richmond/Downloads/Uni-Mart/unimart-backend/src/routes/public.routes.js

const express = require('express');
const router = express.Router();
const Listing = require('../models/Listing');

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    message: 'Public API is running',
    endpoints: [
      '/health',
      '/listings',
      '/trending',
      '/flash-deals',
      '/food',
      '/services',
      '/events',
      '/tech-gadgets',
      '/second-hand',
      '/home-furniture',
      '/campus-life',
      '/categories/:category'
    ]
  });
});

// ==================== MAIN ENDPOINTS ====================

// Get all approved listings (with optional category filter)
router.get('/listings', async (req, res) => {
  try {
    const { page = 1, limit = 20, category, search, sort = '-createdAt' } = req.query;

    const query = { status: 'active', isActive: true };
    
    if (category && category !== 'all') {
      query.category = category;
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const listings = await Listing.find(query)
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Listing.countDocuments(query);

    res.json({
      success: true,
      data: listings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching listings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== SECTION-SPECIFIC ENDPOINTS ====================

// 🔥 Flash Deals - items with discount
router.get('/flash-deals', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const listings = await Listing.find({ 
      status: 'active', 
      isActive: true,
      discount: { $gt: 0 }
    })
      .sort({ discount: -1, createdAt: -1 })
      .limit(parseInt(limit));

    res.json({ success: true, data: listings });
  } catch (error) {
    console.error('Error fetching flash deals:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 📈 Trending - most viewed
router.get('/trending', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const listings = await Listing.find({ status: 'active', isActive: true })
      .sort({ views: -1, sales: -1, createdAt: -1 })
      .limit(parseInt(limit));

    res.json({ success: true, data: listings });
  } catch (error) {
    console.error('Error fetching trending:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 🍽️ Food & Dining
router.get('/food', async (req, res) => {
  try {
    const { limit = 10, sort = '-createdAt' } = req.query;

    const listings = await Listing.find({ 
      status: 'active', 
      isActive: true,
      category: 'Food'
    })
      .sort(sort)
      .limit(parseInt(limit));

    res.json({ success: true, data: listings });
  } catch (error) {
    console.error('Error fetching food:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 🎓 Student Services
router.get('/services', async (req, res) => {
  try {
    const { limit = 10, sort = '-createdAt' } = req.query;

    const listings = await Listing.find({ 
      status: 'active', 
      isActive: true,
      category: 'Services'
    })
      .sort(sort)
      .limit(parseInt(limit));

    res.json({ success: true, data: listings });
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 🎉 Campus Events
router.get('/events', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    // Show upcoming events first
    const listings = await Listing.find({ 
      status: 'active', 
      isActive: true,
      category: 'Events',
      eventDate: { $gte: new Date() }
    })
      .sort({ eventDate: 1, createdAt: -1 })
      .limit(parseInt(limit));

    res.json({ success: true, data: listings });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 💻 Tech Gadgets
router.get('/tech-gadgets', async (req, res) => {
  try {
    const { limit = 10, sort = '-createdAt' } = req.query;

    const listings = await Listing.find({ 
      status: 'active', 
      isActive: true,
      category: 'Tech Gadgets'
    })
      .sort(sort)
      .limit(parseInt(limit));

    res.json({ success: true, data: listings });
  } catch (error) {
    console.error('Error fetching tech gadgets:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ♻️ Second Hand Items
router.get('/second-hand', async (req, res) => {
  try {
    const { limit = 10, sort = '-createdAt' } = req.query;

    const listings = await Listing.find({ 
      status: 'active', 
      isActive: true,
      category: 'Second Hand'
    })
      .sort(sort)
      .limit(parseInt(limit));

    res.json({ success: true, data: listings });
  } catch (error) {
    console.error('Error fetching second hand:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 🏠 Home & Furniture
router.get('/home-furniture', async (req, res) => {
  try {
    const { limit = 10, sort = '-createdAt' } = req.query;

    const listings = await Listing.find({ 
      status: 'active', 
      isActive: true,
      category: 'Home & Furniture'
    })
      .sort(sort)
      .limit(parseInt(limit));

    res.json({ success: true, data: listings });
  } catch (error) {
    console.error('Error fetching home & furniture:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 🏫 Campus Life
router.get('/campus-life', async (req, res) => {
  try {
    const { limit = 10, sort = '-createdAt' } = req.query;

    const listings = await Listing.find({ 
      status: 'active', 
      isActive: true,
      category: 'Campus Life'
    })
      .sort(sort)
      .limit(parseInt(limit));

    res.json({ success: true, data: listings });
  } catch (error) {
    console.error('Error fetching campus life:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== CATEGORY ENDPOINT ====================

// Get by category (generic)
router.get('/categories/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 20, sort = '-createdAt' } = req.query;

    const decodedCategory = decodeURIComponent(category);
    
    const listings = await Listing.find({ 
      status: 'active', 
      isActive: true,
      category: decodedCategory
    })
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Listing.countDocuments({ 
      status: 'active', 
      isActive: true,
      category: decodedCategory
    });

    res.json({
      success: true,
      data: listings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== SINGLE LISTING ====================

// Get single listing (increments view count)
router.get('/listings/:id', async (req, res) => {
  try {
    const listing = await Listing.findOne({ 
      _id: req.params.id, 
      status: 'active', 
      isActive: true 
    });
    
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }

    // Increment view count
    await listing.incrementViews();

    res.json({ success: true, data: listing });
  } catch (error) {
    console.error('Error fetching listing:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== SEARCH ====================

// Search across all categories
router.get('/search', async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    
    if (!q) {
      return res.status(400).json({ success: false, message: 'Search query required' });
    }

    const listings = await Listing.find({ 
      status: 'active', 
      isActive: true,
      $text: { $search: q }
    })
      .sort({ score: { $meta: 'textScore' } })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Listing.countDocuments({ 
      status: 'active', 
      isActive: true,
      $text: { $search: q }
    });

    res.json({
      success: true,
      data: listings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error searching:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;