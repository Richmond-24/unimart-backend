
// /home/richmond/Downloads/Uni-Mart/unimart-backend/src/routes/listings.js

const express = require('express');
const router = express.Router();
const Listing = require('../models/Listing');
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/auth');

// --- Reactions: get counts and user state (optional auth)
router.get('/:id/reactions', optionalAuthMiddleware, async (req, res) => {
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
router.post('/:id/vote', authMiddleware, async (req, res) => {
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

    res.json({ success: true, data: { up: listing.votesUp.length, down: listing.votesDown.length } });
  } catch (error) {
    console.error('Error submitting vote:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- Emoji reaction (authenticated): toggle per-user emoji
router.post('/:id/emoji', authMiddleware, async (req, res) => {
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

    res.json({ success: true, data: { emojis } });
  } catch (error) {
    console.error('Error toggling emoji:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== ADMIN ROUTES ====================

// Get all listings with filters
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      category, 
      userType, 
      search 
    } = req.query;

    const query = {};
    
    if (status && status !== 'all') query.status = status;
    if (category && category !== 'all') query.category = category;
    if (userType && userType !== 'all') query.userType = userType;
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { sellerName: { $regex: search, $options: 'i' } },
        { sellerEmail: { $regex: search, $options: 'i' } }
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

// ✅ APPROVE listing
router.patch('/:id/approve', async (req, res) => {
  try {
    const { adminNotes } = req.body;
    
    const listing = await Listing.findByIdAndUpdate(
      req.params.id,
      {
        status: 'active',
        isActive: true,
        adminNotes: adminNotes || 'Approved by admin',
        approvedAt: new Date()
      },
      { new: true }
    );

    if (!listing) {
      return res.status(404).json({ success: false, error: 'Listing not found' });
    }

    console.log(`✅ Listing approved: ${listing.title} (ID: ${listing._id})`);

    res.json({
      success: true,
      data: listing,
      message: 'Listing approved and now visible in mobile app'
    });
  } catch (error) {
    console.error('Error approving listing:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ❌ REJECT listing
router.patch('/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    
    const listing = await Listing.findByIdAndUpdate(
      req.params.id,
      {
        status: 'rejected',
        isActive: false,
        rejectionReason: reason || 'No reason provided',
        rejectedAt: new Date()
      },
      { new: true }
    );

    if (!listing) {
      return res.status(404).json({ success: false, error: 'Listing not found' });
    }

    console.log(`❌ Listing rejected: ${listing.title} (ID: ${listing._id})`);

    res.json({
      success: true,
      data: listing,
      message: 'Listing rejected and hidden from mobile app'
    });
  } catch (error) {
    console.error('Error rejecting listing:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update status only
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    const listing = await Listing.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!listing) {
      return res.status(404).json({ success: false, error: 'Listing not found' });
    }

    res.json({ success: true, data: listing });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single listing
router.get('/:id', async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ success: false, error: 'Listing not found' });
    }
    res.json({ success: true, data: listing });
  } catch (error) {
    console.error('Error fetching listing:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update listing
router.patch('/:id', async (req, res) => {
  try {
    const listing = await Listing.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!listing) {
      return res.status(404).json({ success: false, error: 'Listing not found' });
    }
    res.json({ success: true, data: listing });
  } catch (error) {
    console.error('Error updating listing:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete listing
router.delete('/:id', async (req, res) => {
  try {
    const listing = await Listing.findByIdAndDelete(req.params.id);
    if (!listing) {
      return res.status(404).json({ success: false, error: 'Listing not found' });
    }
    console.log(`🗑️ Listing deleted: ${listing.title} (ID: ${listing._id})`);
    res.json({ success: true, message: 'Listing deleted' });
  } catch (error) {
    console.error('Error deleting listing:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get dashboard stats
router.get('/stats/overview', async (req, res) => {
  try {
    const total = await Listing.countDocuments();
    const pending = await Listing.countDocuments({ status: 'pending' });
    const active = await Listing.countDocuments({ status: 'active', isActive: true });
    const sold = await Listing.countDocuments({ status: 'sold' });
    const archived = await Listing.countDocuments({ status: 'archived' });
    const rejected = await Listing.countDocuments({ status: 'rejected' });
    
    const totalValueResult = await Listing.aggregate([
      { $match: { status: 'active', isActive: true } },
      { $group: { _id: null, total: { $sum: '$price' } } }
    ]);

    const students = await Listing.countDocuments({ userType: 'student' });
    const vendors = await Listing.countDocuments({ userType: 'vendor' });

    res.json({
      success: true,
      data: {
        total,
        pending,
        active,
        sold,
        archived,
        rejected,
        totalValue: totalValueResult[0]?.total || 0,
        students,
        vendors
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

module.exports = router;