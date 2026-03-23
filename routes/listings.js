
// /backend/routes/listings.js

const express = require('express');
const router = express.Router();
const Listing = require('../models/Listing');
const parser = require('../middleware/parser');
const cloudinary = require('cloudinary').v2;

// ==================== CREATE LISTING ====================
router.post('/', async (req, res) => {
  try {
    const listingData = req.body;

    console.log("📦 Creating new listing:", {
      title: listingData.title,
      sellerEmail: listingData.sellerEmail,
      category: listingData.category,
      imagesCount: listingData.imageUrls?.length || 0
    });

    if (listingData.imageUrls && listingData.imageUrls.length > 0) {
      console.log("📸 Received Cloudinary URLs:", listingData.imageUrls);
    }

    const listing = new Listing({
      ...listingData,
      imageUrls: listingData.imageUrls || [],
      status: 'pending',
      isActive: false
    });

    await listing.save();

    console.log(`✅ Listing saved: ${listing.title} with ${listing.imageUrls.length} images`);

    res.status(201).json({
      success: true,
      data: {
        id: listing._id,
        title: listing.title,
        imageUrls: listing.imageUrls,
        createdAt: listing.createdAt
      },
      message: "Listing submitted successfully"
    });

  } catch (error) {
    console.error("❌ Error creating listing:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== GET ALL LISTINGS ====================
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, status, category, userType, search } = req.query;
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

    console.log('🔍 Fetching listings with query:', query);

    const listings = await Listing.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Listing.countDocuments(query);

    console.log(`📊 Found ${listings.length} listings`);

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

// ==================== GET SINGLE LISTING ====================
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

// ==================== DASHBOARD STATS ====================
router.get('/stats/overview', async (req, res) => {
  try {
    const totalListings = await Listing.countDocuments();
    const pendingListings = await Listing.countDocuments({ status: 'pending' });
    const activeListings = await Listing.countDocuments({ status: 'active', isActive: true });
    const soldListings = await Listing.countDocuments({ status: 'sold' });
    const rejectedListings = await Listing.countDocuments({ status: 'rejected' });

    // Calculate total revenue from sold items
    const soldItems = await Listing.find({ status: 'sold' });
    const totalRevenue = soldItems.reduce((sum, item) => sum + (item.price || 0), 0);

    // Get student vs vendor counts
    const studentListings = await Listing.countDocuments({ userType: 'student' });
    const vendorListings = await Listing.countDocuments({ userType: 'vendor' });

    // Get flash deals count
    const flashDeals = await Listing.countDocuments({ 
      isFlashDeal: true, 
      discount: { $gt: 0 } 
    });

    // Get category counts
    const categories = await Listing.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    const categoryStats = {};
    categories.forEach(cat => {
      if (cat._id) {
        const key = cat._id.toLowerCase().replace(/\s+/g, '');
        categoryStats[key] = cat.count;
      }
    });

    res.json({
      success: true,
      data: {
        total: totalListings,
        pending: pendingListings,
        active: activeListings,
        sold: soldListings,
        rejected: rejectedListings,
        totalRevenue,
        students: studentListings,
        vendors: vendorListings,
        flashDeals,
        ...categoryStats
      }
    });

  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== ANALYTICS - SALES TREND ====================
router.get('/analytics/sales-trend', async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    if (period === '7d') startDate.setDate(startDate.getDate() - 7);
    else if (period === '30d') startDate.setDate(startDate.getDate() - 30);
    else if (period === '90d') startDate.setDate(startDate.getDate() - 90);
    else if (period === '1y') startDate.setFullYear(startDate.getFullYear() - 1);
    else if (period === '24h') startDate.setHours(startDate.getHours() - 24);

    // Get sold items in date range
    const soldItems = await Listing.find({
      status: 'sold',
      updatedAt: { $gte: startDate, $lte: endDate }
    });

    // Group by date
    const salesByDate = {};
    soldItems.forEach(item => {
      const date = item.updatedAt.toISOString().split('T')[0];
      if (!salesByDate[date]) {
        salesByDate[date] = {
          revenue: 0,
          orders: 0
        };
      }
      salesByDate[date].revenue += item.price || 0;
      salesByDate[date].orders += 1;
    });

    // Format for chart
    const result = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayData = salesByDate[dateStr] || { revenue: 0, orders: 0 };
      
      result.push({
        date: dateStr,
        revenue: dayData.revenue,
        orders: dayData.orders
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }

    res.json({ success: true, data: result });

  } catch (error) {
    console.error('Error fetching sales trend:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== ANALYTICS - CATEGORY PERFORMANCE ====================
router.get('/analytics/categories', async (req, res) => {
  try {
    const categories = await Listing.aggregate([
      { $match: { status: 'sold' } },
      { $group: {
        _id: '$category',
        revenue: { $sum: '$price' },
        count: { $sum: 1 }
      }},
      { $sort: { revenue: -1 } }
    ]);

    const result = categories.map(cat => ({
      name: cat._id || 'Uncategorized',
      value: cat.revenue,
      count: cat.count
    }));

    res.json({ success: true, data: result });

  } catch (error) {
    console.error('Error fetching category performance:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== ANALYTICS - TOP PRODUCTS ====================
router.get('/analytics/top-products', async (req, res) => {
  try {
    const { limit = 5 } = req.query;

    const topProducts = await Listing.find({ status: 'sold' })
      .sort({ views: -1, sales: -1 })
      .limit(parseInt(limit))
      .select('title category price views imageUrls');

    const result = topProducts.map(p => ({
      name: p.title,
      category: p.category,
      sold: p.sales || Math.floor(Math.random() * 100) + 50, // Mock if no sales data
      views: p.views || Math.floor(Math.random() * 1000) + 500,
      revenue: (p.price || 0) * (p.sales || Math.floor(Math.random() * 100) + 50)
    }));

    res.json({ success: true, data: result });

  } catch (error) {
    console.error('Error fetching top products:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== ANALYTICS - GEO DISTRIBUTION ====================
router.get('/analytics/geo', async (req, res) => {
  try {
    const locations = await Listing.aggregate([
      { $match: { location: { $exists: true, $ne: '' } } },
      { $group: {
        _id: '$location',
        count: { $sum: 1 }
      }},
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    const total = await Listing.countDocuments({ location: { $exists: true, $ne: '' } });

    const result = locations.map(loc => ({
      name: loc._id.split(',')[0].trim(), // Get city name
      count: loc.count,
      percentage: Math.round((loc.count / total) * 100)
    }));

    res.json({ success: true, data: result });

  } catch (error) {
    console.error('Error fetching geo distribution:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== ANALYTICS - ACTIVITY FEED ====================
router.get('/analytics/activity', async (req, res) => {
  try {
    const { limit = 8 } = req.query;

    // Get recent activities
    const recentListings = await Listing.find()
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select('title sellerName status createdAt');

    const activities = recentListings.map((listing, index) => {
      const colors = ['#27ae60', '#f97316', '#2980b9', '#e74c3c', '#8e44ad'];
      const actions = {
        pending: 'pending approval',
        active: 'approved and live',
        sold: 'marked as sold',
        rejected: 'rejected'
      };

      return {
        color: colors[index % colors.length],
        description: `Listing "${listing.title}" by ${listing.sellerName} is ${actions[listing.status] || listing.status}`,
        time: listing.createdAt
      };
    });

    res.json({ success: true, data: activities });

  } catch (error) {
    console.error('Error fetching activity feed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== UPDATE LISTING ====================
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
    console.error('Error updating listing:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== DELETE LISTING ====================
router.delete('/:id', async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      return res.status(404).json({ success: false, error: 'Listing not found' });
    }

    // Delete images from Cloudinary
    if (listing.imageUrls && listing.imageUrls.length > 0) {
      try {
        for (const imageUrl of listing.imageUrls) {
          const urlParts = imageUrl.split('/');
          const publicIdWithExtension = urlParts[urlParts.length - 1];
          const publicId = `unimart_folder/${publicIdWithExtension.split('.')[0]}`;
          await cloudinary.uploader.destroy(publicId);
        }
        console.log('🗑️ Deleted images from Cloudinary');
      } catch (cloudinaryError) {
        console.error('Error deleting from Cloudinary:', cloudinaryError);
      }
    }

    await Listing.findByIdAndDelete(req.params.id);
    console.log(`🗑️ Listing deleted: ${listing.title}`);
    res.json({ success: true, message: 'Listing deleted' });

  } catch (error) {
    console.error('Error deleting listing:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== APPROVE LISTING ====================
router.patch('/:id/approve', async (req, res) => {
  try {
    const listing = await Listing.findByIdAndUpdate(
      req.params.id,
      {
        status: 'active',
        isActive: true,
        approvedAt: new Date()
      },
      { new: true }
    );

    if (!listing) {
      return res.status(404).json({ success: false, error: 'Listing not found' });
    }

    console.log(`✅ Listing approved: ${listing.title}`);
    res.json({ success: true, data: listing, message: 'Listing approved' });

  } catch (error) {
    console.error('Error approving listing:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== REJECT LISTING ====================
router.patch('/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;

    const listing = await Listing.findByIdAndUpdate(
      req.params.id,
      {
        status: 'rejected',
        isActive: false,
        rejectionReason: reason || 'Rejected by admin',
        rejectedAt: new Date()
      },
      { new: true }
    );

    if (!listing) {
      return res.status(404).json({ success: false, error: 'Listing not found' });
    }

    console.log(`❌ Listing rejected: ${listing.title}`);
    res.json({ success: true, data: listing, message: 'Listing rejected' });

  } catch (error) {
    console.error('Error rejecting listing:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== DEBUG ENDPOINT ====================
router.get('/debug/check', async (req, res) => {
  try {
    const count = await Listing.countDocuments();
    const recent = await Listing.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title imageUrls status sellerName price');

    const statusCounts = {
      pending: await Listing.countDocuments({ status: 'pending' }),
      active: await Listing.countDocuments({ status: 'active' }),
      sold: await Listing.countDocuments({ status: 'sold' }),
      rejected: await Listing.countDocuments({ status: 'rejected' })
    };

    res.json({
      success: true,
      totalListings: count,
      statusCounts,
      recentListings: recent,
      message: 'Debug endpoint - check imageUrls field'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;