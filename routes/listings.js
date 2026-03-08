// routes/listings.js
const express = require('express');
const router = express.Router();
const Listing = require('../models/listings');

// Get all listings
router.get('/', async (req, res) => {
  try {
    const { status, limit = 20, page = 1 } = req.query;
    
    let query = {};
    if (status) query.status = status;
    
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
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create listing
router.post('/', async (req, res) => {
  try {
    const listing = new Listing(req.body);
    await listing.save();
    res.status(201).json({ success: true, data: listing });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update listing
router.patch('/:id', async (req, res) => {
  try {
    const listing = await Listing.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!listing) {
      return res.status(404).json({ success: false, error: 'Listing not found' });
    }
    res.json({ success: true, data: listing });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Delete listing
router.delete('/:id', async (req, res) => {
  try {
    const listing = await Listing.findByIdAndDelete(req.params.id);
    if (!listing) {
      return res.status(404).json({ success: false, error: 'Listing not found' });
    }
    res.json({ success: true, message: 'Listing deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;