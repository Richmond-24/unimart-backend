// /home/richmond/Downloads/Uni-Mart/unimart-backend/src/routes/public.routes.js

const express = require('express');
const router = express.Router();
const Listing = require('../models/Listing');
const Category = require('../models/Category.model');
const Seller = require('../models/Seller.model');
const User = require('../models/User.model');
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/auth');

// ==================== CATEGORY-SPECIFIC ENDPOINTS ====================
// These are what the mobile app uses to populate each section

// 🍽️ Food & Dining
router.get('/food', async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;
    
    const listings = await Listing.find({ 
      status: 'active', 
      isActive: true,
      category: 'Food'
    })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    res.json({ 
      success: true, 
      data: listings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: await Listing.countDocuments({ category: 'Food', status: 'active', isActive: true })
      }
    });
  } catch (error) {
    console.error('Error fetching food:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 🎓 Student Services
router.get('/services', async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;
    
    const listings = await Listing.find({ 
      status: 'active', 
      isActive: true,
      category: 'Services'
    })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    res.json({ 
      success: true, 
      data: listings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: await Listing.countDocuments({ category: 'Services', status: 'active', isActive: true })
      }
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 🎉 Campus Events (Upcoming)
router.get('/events', async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;
    
    const listings = await Listing.find({ 
      status: 'active', 
      isActive: true,
      category: 'Events',
      eventDate: { $gte: new Date() } // Only upcoming events
    })
      .sort({ eventDate: 1 }) // Sort by date ascending
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    res.json({ 
      success: true, 
      data: listings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: await Listing.countDocuments({ 
          category: 'Events', 
          status: 'active', 
          isActive: true,
          eventDate: { $gte: new Date() }
        })
      }
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 💻 Tech Gadgets
router.get('/tech-gadgets', async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;
    
    const listings = await Listing.find({ 
      status: 'active', 
      isActive: true,
      category: 'Tech Gadgets'
    })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    res.json({ 
      success: true, 
      data: listings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: await Listing.countDocuments({ category: 'Tech Gadgets', status: 'active', isActive: true })
      }
    });
  } catch (error) {
    console.error('Error fetching tech gadgets:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ♻️ Second Hand Items
router.get('/second-hand', async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;
    
    const listings = await Listing.find({ 
      status: 'active', 
      isActive: true,
      category: 'Second Hand'
    })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    res.json({ 
      success: true, 
      data: listings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: await Listing.countDocuments({ category: 'Second Hand', status: 'active', isActive: true })
      }
    });
  } catch (error) {
    console.error('Error fetching second hand:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 🏠 Home & Furniture
router.get('/home-furniture', async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;
    
    const listings = await Listing.find({ 
      status: 'active', 
      isActive: true,
      category: 'Home & Furniture'
    })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    res.json({ 
      success: true, 
      data: listings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: await Listing.countDocuments({ category: 'Home & Furniture', status: 'active', isActive: true })
      }
    });
  } catch (error) {
    console.error('Error fetching home furniture:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 🏫 Campus Life
router.get('/campus-life', async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;
    
    const listings = await Listing.find({ 
      status: 'active', 
      isActive: true,
      category: 'Campus Life'
    })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    res.json({ 
      success: true, 
      data: listings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: await Listing.countDocuments({ category: 'Campus Life', status: 'active', isActive: true })
      }
    });
  } catch (error) {
    console.error('Error fetching campus life:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 🏫 Campus Trending (curated/sorted within Campus Life)
router.get('/campus-trending', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const listings = await Listing.find({
      status: 'active',
      isActive: true,
      category: 'Campus Life'
    })
      .sort({ views: -1, sales: -1, createdAt: -1 })
      .limit(parseInt(limit));

    res.json({ success: true, data: listings });
  } catch (error) {
    console.error('Error fetching campus trending:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// � Top Sellers
router.get('/top-sellers', async (req, res) => {
  try {
    const { limit = 10, university } = req.query;
    const sellerMatch = { isActive: true };
    if (university) sellerMatch.university = university;

    const sellers = await Seller.aggregate([
      { $match: sellerMatch },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $lookup: {
          from: 'listings',
          let: { sellerEmail: '$user.email' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$sellerEmail', '$$sellerEmail'] },
                status: 'active',
                isActive: true
              }
            },
            {
              $group: {
                _id: null,
                totalViews: { $sum: '$views' },
                totalSales: { $sum: '$sales' },
                itemCount: { $sum: 1 }
              }
            }
          ],
          as: 'listingStats'
        }
      },
      {
        $unwind: {
          path: '$listingStats',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $addFields: {
          totalViews: { $ifNull: ['$listingStats.totalViews', 0] },
          totalSales: { $ifNull: ['$listingStats.totalSales', 0] },
          itemCount: { $ifNull: ['$listingStats.itemCount', 0] }
        }
      },
      { $match: { itemCount: { $gt: 0 } } },
      {
        $sort: {
          totalViews: -1,
          totalSales: -1,
          rating: -1,
          createdAt: -1
        }
      },
      { $limit: Number(limit) }
    ]);

    res.json({ success: true, data: sellers });
  } catch (error) {
    console.error('Error fetching top sellers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 🧑‍💼 Public Sellers
router.get('/sellers', async (req, res) => {
  try {
    const { limit = 10, page = 1, university } = req.query;
    const query = { isActive: true };
    if (university) query.university = university;

    const sellers = await Seller.find(query)
      .populate('user', 'name avatar email university hall')
      .sort({ rating: -1, totalSales: -1, createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    const total = await Seller.countDocuments(query);
    res.json({ success: true, data: sellers, total, page: Number(page) });
  } catch (error) {
    console.error('Error fetching public sellers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// �🔥 Flash Deals (items with discount)
router.get('/flash-deals', async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;
    
    const listings = await Listing.find({ 
      status: 'active', 
      isActive: true,
      discount: { $gt: 0 }
    })
      .sort({ discount: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    res.json({ 
      success: true, 
      data: listings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: await Listing.countDocuments({ 
          status: 'active', 
          isActive: true,
          discount: { $gt: 0 }
        })
      }
    });
  } catch (error) {
    console.error('Error fetching flash deals:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 📈 Trending (most viewed)
router.get('/trending', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const listings = await Listing.find({ 
      status: 'active', 
      isActive: true
    })
      .sort({ views: -1, sales: -1, createdAt: -1 })
      .limit(parseInt(limit));

    res.json({ success: true, data: listings });
  } catch (error) {
    console.error('Error fetching trending:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 📱 General listings endpoint (with category filter)
router.get('/listings', async (req, res) => {
  try {
    const { page = 1, limit = 20, category, search, sellerId, sellerEmail, sellerName } = req.query;

    const query = { status: 'active', isActive: true };
    
    if (category && category !== 'all') {
      query.category = category;
    }

    if (sellerEmail) {
      query.sellerEmail = String(sellerEmail).toLowerCase().trim();
    } else if (sellerId) {
      const resolvedUser = await User.findById(sellerId).select('email').lean().catch(() => null);
      if (resolvedUser?.email) {
        query.sellerEmail = resolvedUser.email;
      } else {
        query.$or = [
          { sellerName: new RegExp(String(sellerId), 'i') },
          { sellerEmail: String(sellerId) }
        ];
      }
    }

    if (sellerName) {
      query.sellerName = new RegExp(String(sellerName), 'i');
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const listings = await Listing.find(query)
      .sort({ createdAt: -1 })
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

// 🔍 Search endpoint
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

// 📄 Single listing
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

    const result = listing.toObject();
    try {
      const sellerUser = await User.findOne({ email: String(listing.sellerEmail).toLowerCase().trim() }).select('_id').lean();
      if (sellerUser) {
        result.sellerId = sellerUser._id.toString();
      }
    } catch (err) {
      console.debug('Unable to resolve sellerId for listing response:', err?.message || err);
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching listing:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Reactions: get counts and user state (optional auth)
router.get('/listings/:id/reactions', optionalAuthMiddleware, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id).select('votesUp votesDown emojiReactions');
    if (!listing) return res.status(404).json({ success: false, error: 'Listing not found' });

    const up = Array.isArray(listing.votesUp) ? listing.votesUp.length : 0;
    const down = Array.isArray(listing.votesDown) ? listing.votesDown.length : 0;
    const emojis = {};
    (listing.emojiReactions || []).forEach(er => {
      const idx = er.emojiIndex ?? 0;
      emojis[idx] = (emojis[idx] || 0) + 1;
    });

    let userVote = null;
    let userEmoji = null;
    if (req.user && req.user._id) {
      const uid = req.user._id.toString ? req.user._id.toString() : String(req.user._id);
      if ((listing.votesUp || []).some(u => String(u) === uid)) userVote = 'up';
      else if ((listing.votesDown || []).some(u => String(u) === uid)) userVote = 'down';
      const eu = (listing.emojiReactions || []).find(er => String(er.user) === uid);
      if (eu) userEmoji = eu.emojiIndex;
    }

    res.json({ success: true, data: { up, down, emojis, userVote, userEmoji } });
  } catch (error) {
    console.error('Error fetching reactions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- Vote (authenticated)
router.post('/listings/:id/vote', authMiddleware, async (req, res) => {
  try {
    const { vote } = req.body; // 'up' | 'down' | 'remove'
    if (!['up','down','remove'].includes(vote)) return res.status(400).json({ success: false, error: 'Invalid vote' });

    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ success: false, error: 'Listing not found' });

    const uid = req.user._id.toString ? req.user._id.toString() : String(req.user._id);

    // Remove from both lists first
    listing.votesUp = (listing.votesUp || []).filter(u => String(u) !== uid);
    listing.votesDown = (listing.votesDown || []).filter(u => String(u) !== uid);

    if (vote === 'up') listing.votesUp.push(req.user._id);
    else if (vote === 'down') listing.votesDown.push(req.user._id);

    await listing.save();

    res.json({ success: true, data: { up: listing.votesUp.length, down: listing.votesDown.length, userVote: vote === 'remove' ? null : vote } });
  } catch (error) {
    console.error('Error submitting vote:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- Emoji reaction (authenticated): toggle per-user emoji
router.post('/listings/:id/emoji', authMiddleware, async (req, res) => {
  try {
    const { emojiIndex } = req.body;
    if (typeof emojiIndex === 'undefined' || emojiIndex === null) return res.status(400).json({ success: false, error: 'emojiIndex required' });

    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ success: false, error: 'Listing not found' });

    const uid = req.user._id.toString ? req.user._id.toString() : String(req.user._id);

    // See if user already reacted and what they reacted with
    const existing = (listing.emojiReactions || []).find(er => String(er.user) === uid);
    const existingIndex = existing ? existing.emojiIndex : null;

    // Remove any existing reaction by this user
    listing.emojiReactions = (listing.emojiReactions || []).filter(er => String(er.user) !== uid);

    // If user had same emoji, we've toggled off; otherwise add new
    if (existingIndex === Number(emojiIndex)) {
      // toggled off - do nothing
    } else {
      listing.emojiReactions.push({ user: req.user._id, emojiIndex: Number(emojiIndex) });
    }

    await listing.save();

    // return aggregated emoji counts
    const emojis = {};
    (listing.emojiReactions || []).forEach(er => {
      const idx = er.emojiIndex ?? 0;
      emojis[idx] = (emojis[idx] || 0) + 1;
    });

    const userEmoji = (listing.emojiReactions || []).find(er => String(er.user) === uid)?.emojiIndex ?? null;

    res.json({ success: true, data: { emojis, userEmoji } });
  } catch (error) {
    console.error('Error toggling emoji:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 🏷️ Get by category (generic)
router.get('/categories/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const decodedCategory = decodeURIComponent(category);
    
    const listings = await Listing.find({ 
      status: 'active', 
      isActive: true,
      category: decodedCategory
    })
      .sort({ createdAt: -1 })
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

// 📚 Get all active categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).sort('order');
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ❤️ Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    message: 'Public API is running',
    endpoints: [
      '/health',
      '/food',
      '/services', 
      '/events',
      '/tech-gadgets',
      '/second-hand',
      '/home-furniture',
      '/campus-life',
      '/flash-deals',
      '/trending',
      '/listings',
      '/search',
      '/categories',
      '/categories/:category',
      '/listings/:id'
    ]
  });
});

module.exports = router;