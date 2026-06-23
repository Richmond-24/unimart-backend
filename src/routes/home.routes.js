
const express = require('express');
const router = express.Router();

// Simple route handlers
router.get('/', function(req, res) {
  res.json({
    success: true,
    message: 'Home API is working',
    data: {
      featured: [],
      categories: [],
      deals: []
    }
  });
});

router.get('/featured', function(req, res) {
  res.json({ success: true, data: [] });
});

router.get('/trending', function(req, res) {
  res.json({ success: true, data: [] });
});

router.get('/new-arrivals', function(req, res) {
  res.json({ success: true, data: [] });
});

router.get('/banners', function(req, res) {
  res.json({ success: true, data: [] });
});

router.get('/stats', function(req, res) {
  res.json({ success: true, data: {} });
});

console.log('✅ Home routes created successfully');

module.exports = router;