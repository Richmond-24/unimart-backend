const Listing = require('../models/Listing');

// @desc    Create a new listing
// @route   POST /api/listings
// @access  Public
exports.createListing = async (req, res) => {
  try {
    console.log('📥 Received listing creation request');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    const listingData = {
      ...req.body,
      // Ensure imageUrls is properly set
      imageUrls: req.body.imageUrls || [],
      // Set default values if not provided
      status: 'pending',
      isActive: false,
      views: 0,
      sales: 0
    };

    // Validate required fields
    if (!listingData.sellerName || !listingData.sellerEmail || !listingData.title || !listingData.price) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const listing = new Listing(listingData);
    await listing.save();

    console.log('✅ Listing created successfully with ID:', listing._id);
    console.log('📸 Image URLs saved:', listing.imageUrls);

    res.status(201).json({
      success: true,
      data: listing,
      message: 'Listing created successfully'
    });

  } catch (error) {
    console.error('❌ Error creating listing:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get all listings with filters
// @route   GET /api/listings
// @access  Public
exports.getListings = async (req, res) => {
  try {
    const {
      status,
      category,
      userType,
      search,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (category && category !== 'all') {
      query.category = category;
    }
    
    if (userType && userType !== 'all') {
      query.userType = userType;
    }
    
    if (search) {
      query.$text = { $search: search };
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sorting
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    console.log('🔍 Fetching listings with query:', JSON.stringify(query, null, 2));

    // Execute query
    const listings = await Listing.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    const total = await Listing.countDocuments(query);

    console.log(`📊 Found ${listings.length} listings (total: ${total})`);
    
    // Log first few listings to verify images
    listings.slice(0, 3).forEach((listing, index) => {
      console.log(`Listing ${index + 1}: ${listing.title} - Images:`, listing.imageUrls);
    });

    res.json({
      success: true,
      data: listings,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });

  } catch (error) {
    console.error('❌ Error fetching listings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get single listing by ID
// @route   GET /api/listings/:id
// @access  Public
exports.getListingById = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    
    if (!listing) {
      return res.status(404).json({
        success: false,
        error: 'Listing not found'
      });
    }

    // Increment views
    await listing.incrementViews();

    res.json({
      success: true,
      data: listing
    });

  } catch (error) {
    console.error('❌ Error fetching listing:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Approve listing
// @route   PATCH /api/listings/:id/approve
// @access  Private (Admin only)
exports.approveListing = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    
    if (!listing) {
      return res.status(404).json({
        success: false,
        error: 'Listing not found'
      });
    }

    // Update listing with approval data
    listing.status = 'active';
    listing.isActive = true;
    listing.approvedAt = new Date();
    
    // Update category if provided
    if (req.body.category) {
      listing.category = req.body.category;
    }
    
    // Update flash deal settings
    if (req.body.isFlashDeal) {
      listing.isFlashDeal = true;
      listing.discount = req.body.discount || 10;
      if (req.body.flashDealExpiry) {
        listing.flashDealExpiry = new Date(req.body.flashDealExpiry);
      }
    }
    
    // Update featured status
    if (req.body.isFeatured) {
      listing.featured = true;
    }
    
    // Add admin notes
    if (req.body.adminNotes) {
      listing.adminNotes = req.body.adminNotes;
    }
    
    // Update category-specific fields
    if (req.body.category === 'Events') {
      listing.eventDate = req.body.eventDate;
      listing.eventLocation = req.body.eventLocation;
      listing.maxAttendees = req.body.maxAttendees;
    }
    
    if (req.body.category === 'Food') {
      listing.preparationTime = req.body.preparationTime;
      listing.deliveryFee = req.body.deliveryFee;
      listing.chef = req.body.chef;
      listing.cuisine = req.body.cuisine;
      listing.isVegetarian = req.body.isVegetarian;
      listing.isVegan = req.body.isVegan;
    }
    
    if (req.body.category === 'Services') {
      listing.providerName = req.body.providerName;
      listing.serviceAvailability = req.body.serviceAvailability;
      listing.serviceDuration = req.body.serviceDuration;
      listing.onlineAvailable = req.body.onlineAvailable;
    }
    
    if (req.body.category === 'Tech Gadgets' && req.body.specs) {
      listing.specs = { ...listing.specs, ...req.body.specs };
    }
    
    await listing.save();

    console.log('✅ Listing approved:', listing._id);

    res.json({
      success: true,
      data: listing,
      message: 'Listing approved successfully'
    });

  } catch (error) {
    console.error('❌ Error approving listing:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Reject listing
// @route   PATCH /api/listings/:id/reject
// @access  Private (Admin only)
exports.rejectListing = async (req, res) => {
  try {
    const { reason } = req.body;
    
    const listing = await Listing.findByIdAndUpdate(
      req.params.id,
      {
        status: 'rejected',
        isActive: false,
        rejectionReason: reason,
        rejectedAt: new Date()
      },
      { new: true }
    );

    if (!listing) {
      return res.status(404).json({
        success: false,
        error: 'Listing not found'
      });
    }

    console.log('❌ Listing rejected:', listing._id, 'Reason:', reason);

    res.json({
      success: true,
      data: listing,
      message: 'Listing rejected successfully'
    });

  } catch (error) {
    console.error('❌ Error rejecting listing:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Update listing
// @route   PATCH /api/listings/:id
// @access  Private (Admin only)
exports.updateListing = async (req, res) => {
  try {
    const listing = await Listing.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!listing) {
      return res.status(404).json({
        success: false,
        error: 'Listing not found'
      });
    }

    console.log('📝 Listing updated:', listing._id);

    res.json({
      success: true,
      data: listing,
      message: 'Listing updated successfully'
    });

  } catch (error) {
    console.error('❌ Error updating listing:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Delete listing
// @route   DELETE /api/listings/:id
// @access  Private (Admin only)
exports.deleteListing = async (req, res) => {
  try {
    const listing = await Listing.findByIdAndDelete(req.params.id);

    if (!listing) {
      return res.status(404).json({
        success: false,
        error: 'Listing not found'
      });
    }

    console.log('🗑️ Listing deleted:', req.params.id);

    res.json({
      success: true,
      message: 'Listing deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting listing:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get dashboard stats
// @route   GET /api/listings/stats/overview
// @access  Private (Admin only)
exports.getStats = async (req, res) => {
  try {
    const stats = {
      total: await Listing.countDocuments(),
      pending: await Listing.countDocuments({ status: 'pending' }),
      active: await Listing.countDocuments({ status: 'active', isActive: true }),
      sold: await Listing.countDocuments({ status: 'sold' }),
      rejected: await Listing.countDocuments({ status: 'rejected' }),
      students: await Listing.countDocuments({ userType: 'student' }),
      vendors: await Listing.countDocuments({ userType: 'vendor' }),
      flashDeals: await Listing.countDocuments({ isFlashDeal: true, discount: { $gt: 0 } }),
      totalValue: await Listing.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: null, total: { $sum: '$price' } } }
      ])
    };

    // Get category counts
    const categories = await Listing.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    const categoryStats = {};
    categories.forEach(cat => {
      categoryStats[cat._id?.toLowerCase().replace(/\s+/g, '') || 'other'] = cat.count;
    });

    res.json({
      success: true,
      data: {
        ...stats,
        ...categoryStats
      }
    });

  } catch (error) {
    console.error('❌ Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};