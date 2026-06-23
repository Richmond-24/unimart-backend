
const router = require('express').Router();
const Category = require('../models/Category.model');
const Listing = require('../models/Listing');
const { protect, admin } = require('../middleware/auth.middleware'); // Change authorize to admin

// Public route - get all active categories
router.get('/', async (req, res, next) => {
  try {
    const data = await Category.find({ isActive: true }).sort('order');
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// ==================== GET PRODUCTS BY CATEGORY NAME ====================
/**
 * @route GET /api/categories/:categoryName
 * @desc Get products by category name with pagination
 * @query limit: number of products (default 20)
 * @query page: page number (default 1)
 * @query sort: sort field (default -createdAt)
 * @access Public
 */
router.get('/:categoryName', async (req, res, next) => {
  try {
    const { categoryName } = req.params;
    const { limit = 20, page = 1, sort = '-createdAt' } = req.query;

    console.log(`📡 Fetching products for category: ${categoryName}`);

    // Find products by category (case-insensitive)
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const products = await Listing.find({
      status: 'active',
      isActive: true,
      category: { $regex: categoryName, $options: 'i' }
    })
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v')
      .lean();

    const total = await Listing.countDocuments({
      status: 'active',
      isActive: true,
      category: { $regex: categoryName, $options: 'i' }
    });

    if (!products || products.length === 0) {
      console.log(`⚠️ No products found for category: ${categoryName}`);
      return res.json({
        success: true,
        data: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          pages: 0
        }
      });
    }

    console.log(`✅ Found ${products.length} products for ${categoryName} (Total: ${total})`);

    res.json({
      success: true,
      data: products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error(`❌ Error fetching products for category:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch products'
    });
  }
});

// Admin only route - create category
router.post('/', protect, admin, async (req, res, next) => { // Use admin here instead of authorize('admin')
  try {
    const data = await Category.create(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
});

// Add other CRUD routes as needed
router.put('/:id', protect, admin, async (req, res, next) => {
  try {
    const data = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.delete('/:id', protect, admin, async (req, res, next) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (err) { next(err); }
});

module.exports = router;