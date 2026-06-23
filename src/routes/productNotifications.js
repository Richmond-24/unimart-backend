// unimart-backend/src/routes/productNotifications.js
// Backend routes for product listing notifications and admin triggers

const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const Product = require('../models/Product.model');
const User = require('../models/User.model');
const { protect } = require('../middleware/auth.middleware');

/**
 * POST /api/product-notifications/new-listing
 * Admin triggers notification when listing new product
 */
router.post('/new-listing', protect, async (req, res) => {
  try {
    const adminId = req.user.id;
    const { productId, productName, price, category, campus, description } = req.body;

    // Verify product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Fetch users to notify (same campus/category interest)
    const targetUsers = await User.find({
      $or: [
        { campus }, // Same campus
        { 'preferences.interests': category }, // Same category interest
        { role: 'student' }, // All students
      ],
      _id: { $ne: adminId }, // Exclude admin
    }).select('_id');

    const userIds = targetUsers.map((u) => u._id);

    // Create notifications for each user
    const notifications = userIds.map((userId) => ({
      userId,
      type: 'new_product',
      title: `🎉 New Product Listed - ${category}`,
      body: `${productName} is now available for ₦${price.toLocaleString()}`,
      data: {
        productId,
        productName,
        price,
        category,
        campus,
        image: product.images?.[0] || null,
      },
      priority: 'high',
      read: false,
      createdAt: new Date(),
    }));

    await Notification.insertMany(notifications);

    res.json({
      success: true,
      notified: userIds.length,
      message: `New product notification sent to ${userIds.length} users`,
    });
  } catch (error) {
    console.error('Error creating product notification:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/product-notifications/flash-deal
 * Create flash deal notification
 */
router.post('/flash-deal', protect, async (req, res) => {
  try {
    const {
      productId,
      productName,
      originalPrice,
      salePrice,
      discount,
      endsAt,
      category,
      quantity,
    } = req.body;

    // Fetch users to notify
    const targetUsers = await User.find({
      $or: [
        category ? { 'preferences.interests': category } : {},
        { role: 'student' },
      ],
    }).select('_id');

    const userIds = targetUsers.map((u) => u._id);

    // Calculate discount percentage
    const discountPercent = Math.round(
      ((originalPrice - salePrice) / originalPrice) * 100
    );

    const notifications = userIds.map((userId) => ({
      userId,
      type: 'flash_deal',
      title: `🔥 Flash Deal! ${discountPercent}% Off`,
      body: `${productName} - ₦${salePrice.toLocaleString()} (was ₦${originalPrice.toLocaleString()})`,
      data: {
        productId,
        productName,
        originalPrice,
        salePrice,
        discount: discountPercent,
        endsAt,
        category,
        quantity,
      },
      priority: 'urgent',
      read: false,
      createdAt: new Date(),
      expiresAt: new Date(endsAt),
    }));

    await Notification.insertMany(notifications);

    res.json({
      success: true,
      notified: userIds.length,
      discountPercent,
    });
  } catch (error) {
    console.error('Error creating flash deal notification:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/product-notifications/restock
 * Notify when product is back in stock
 */
router.post('/restock', protect, async (req, res) => {
  try {
    const { productId, productName, price } = req.body;

    // Find users who have this product in wishlist/bookmarked
    const targetUsers = await User.find({
      $or: [
        { 'wishlist': productId },
        { 'viewedProducts': productId },
      ],
    }).select('_id');

    const userIds = targetUsers.map((u) => u._id);

    const notifications = userIds.map((userId) => ({
      userId,
      type: 'new_product',
      title: `✨ Back in Stock!`,
      body: `${productName} is now available again - ₦${price.toLocaleString()}`,
      data: {
        productId,
        productName,
        price,
      },
      priority: 'high',
      read: false,
      createdAt: new Date(),
    }));

    await Notification.insertMany(notifications);

    res.json({
      success: true,
      notified: userIds.length,
    });
  } catch (error) {
    console.error('Error creating restock notification:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/product-notifications/seller-activity
 * Notify about seller activity (e.g., "X other students bought this recently")
 */
router.post('/seller-activity', protect, async (req, res) => {
  try {
    const { productId, productName, buyerCount, campus } = req.body;

    // Notify users in same campus
    const targetUsers = await User.find({
      campus,
      role: 'student',
    }).select('_id');

    const userIds = targetUsers.map((u) => u._id);

    const notifications = userIds.map((userId) => ({
      userId,
      type: 'new_product',
      title: `📈 Popular on Campus!`,
      body: `${buyerCount} students in your campus bought "${productName}" recently`,
      data: {
        productId,
        productName,
        buyerCount,
        campus,
      },
      priority: 'medium',
      read: false,
      createdAt: new Date(),
    }));

    await Notification.insertMany(notifications);

    res.json({
      success: true,
      notified: userIds.length,
    });
  } catch (error) {
    console.error('Error creating activity notification:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/product-notifications/trending
 * Get trending products for notification carousel
 */
router.get('/trending', async (req, res) => {
  try {
    const { category, limit = 5 } = req.query;

    const query = category ? { category } : {};

    const products = await Product.find(query)
      .sort({ rating: -1, 'sales': -1 })
      .limit(parseInt(limit))
      .select('_id name description price images seller rating sales');

    res.json(products);
  } catch (error) {
    console.error('Error fetching trending products:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/product-notifications/flash-deals
 * Get current flash deals for display
 */
router.get('/flash-deals', async (req, res) => {
  try {
    const { category } = req.query;
    const now = new Date();

    const query = {
      'flashDeal.active': true,
      'flashDeal.endsAt': { $gt: now },
    };

    if (category) {
      query.category = category;
    }

    const deals = await Product.find(query)
      .sort({ 'flashDeal.discount': -1 })
      .select(
        '_id name description price images flashDeal category seller'
      );

    res.json(deals);
  } catch (error) {
    console.error('Error fetching flash deals:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/product-notifications/notify-students
 * Admin: Notify specific group of students
 */
router.post('/notify-students', protect, async (req, res) => {
  try {
    // Verify admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { title, body, userIds, category, campus, type = 'admin_message' } =
      req.body;

    // Filter users if category/campus provided
    let targetUserIds = userIds;
    if (!userIds || userIds.length === 0) {
      const query = {};
      if (campus) query.campus = campus;

      const users = await User.find(query).select('_id');
      targetUserIds = users.map((u) => u._id);
    }

    const notifications = targetUserIds.map((userId) => ({
      userId,
      type,
      title,
      body,
      data: { category, campus },
      priority: 'high',
      read: false,
      createdAt: new Date(),
    }));

    await Notification.insertMany(notifications);

    res.json({
      success: true,
      notified: targetUserIds.length,
    });
  } catch (error) {
    console.error('Error notifying students:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/product-notifications/:id
 * Delete a notification
 */
router.delete('/:id', protect, async (req, res) => {
  try {
    const notification = await Notification.findByIdAndDelete(req.params.id);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
