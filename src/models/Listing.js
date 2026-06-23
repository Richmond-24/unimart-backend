
// /home/richmond/Downloads/Uni-Mart/unimart-backend/src/models/Listing.js

const mongoose = require('mongoose');

// Define the listing schema
const listingSchema = new mongoose.Schema({
  // ==================== SELLER INFORMATION ====================
  businessName: {
    type: String,
    trim: true
  },
  sellerName: { 
    type: String, 
    required: [true, 'Seller name is required'],
    trim: true,
    index: true
  },
  sellerEmail: { 
    type: String, 
    required: [true, 'Seller email is required'],
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address']
  },
  sellerPhone: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    trim: true,
    default: 'Campus'
  },
  userType: { 
    type: String, 
    enum: ['student', 'vendor'], 
    default: 'student' 
  },
  
  // ==================== PRODUCT INFORMATION ====================
  title: { 
    type: String, 
    required: [true, 'Product title is required'],
    trim: true,
    index: true
  },
  description: {
    type: String,
    trim: true
  },
  category: { 
    type: String, 
    enum: [
      'Electronics', 
      'Fashion', 
      'Books', 
      'Food', 
      'Services', 
      'Events',
      'Second Hand',
      'Tech Gadgets',
      'Campus Life',
      'Home & Furniture',
      'Other'
    ],
    required: [true, 'Category is required'],
    index: true
  },
  subcategory: {
    type: String,
    trim: true
  },
  brand: {
    type: String,
    trim: true
  },
  condition: {
    type: String,
    enum: ['New', 'Like New', 'Good', 'Fair', 'Poor', 'Used'],
    default: 'New'
  },
  conditionNotes: {
    type: String,
    trim: true
  },
  price: { 
    type: Number, 
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative'],
    index: true
  },
  discount: { 
    type: Number, 
    default: 0,
    min: 0,
    max: 100,
    index: true
  },
  edition: {
    type: String,
    trim: true
  },
  
  // ==================== DELIVERY & PAYMENT ====================
  deliveryType: { 
    type: String, 
    enum: ['self', 'unimart'], 
    default: 'self' 
  },
  paymentMethod: { 
    type: String, 
    enum: ['mtn', 'telecel', 'cash'], 
    default: 'mtn' 
  },
  
  // ==================== METADATA ====================
  tags: [{
    type: String,
    trim: true
  }],
  imageUrls: [{
    type: String,
    validate: {
      validator: function(v) {
        return /^(https?:\/\/.*\.(?:png|jpg|jpeg|gif|webp))$/.test(v);
      },
      message: 'Please provide valid image URLs'
    }
  }],
  confidence: {
    type: Number,
    min: 0,
    max: 1
  },
  
  // ==================== APPROVAL STATUS ====================
  status: { 
    type: String, 
    enum: ['pending', 'active', 'sold', 'archived', 'rejected'], 
    default: 'pending',
    index: true
  },
  isActive: { 
    type: Boolean, 
    default: false,
    index: true 
  },
  
  // ==================== ADMIN FIELDS ====================
  adminNotes: {
    type: String,
    trim: true
  },
  rejectionReason: {
    type: String,
    trim: true
  },
  featured: { 
    type: Boolean, 
    default: false 
  },
  
  // ==================== ANALYTICS ====================
  views: { 
    type: Number, 
    default: 0,
    min: 0
  },
  sales: { 
    type: Number, 
    default: 0,
    min: 0
  },
  // ==================== REACTIONS & VOTES ====================
  votesUp: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  votesDown: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  emojiReactions: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, emojiIndex: Number }],
  
  // ==================== SECTION-SPECIFIC FIELDS ====================
  
  // 🔥 Flash Deals
  isFlashDeal: { 
    type: Boolean, 
    default: false 
  },
  flashDealExpiry: {
    type: Date,
    validate: {
      validator: function(v) {
        return !this.isFlashDeal || (v && v > new Date());
      },
      message: 'Flash deal expiry must be a future date'
    }
  },
  
  // 🍽️ Food & Dining specific fields
  preparationTime: {
    type: String,
    trim: true
  },
  deliveryFee: {
    type: Number,
    min: 0
  },
  chef: {
    type: String,
    trim: true
  },
  cuisine: {
    type: String,
    trim: true
  },
  isVegetarian: { 
    type: Boolean, 
    default: false 
  },
  isVegan: { 
    type: Boolean, 
    default: false 
  },
  spicyLevel: { 
    type: String, 
    enum: ['mild', 'medium', 'hot', 'extra hot'] 
  },
  
  // 🎓 Services specific fields
  providerName: {
    type: String,
    trim: true
  },
  serviceAvailability: {
    type: String,
    trim: true
  },
  serviceDuration: {
    type: String,
    trim: true
  },
  onlineAvailable: { 
    type: Boolean, 
    default: false 
  },
  qualifications: [{
    type: String,
    trim: true
  }],
  
  // 🎉 Events specific fields
  eventDate: {
    type: Date,
    validate: {
      validator: function(v) {
        return !this.category || this.category !== 'Events' || (v && v > new Date());
      },
      message: 'Event date must be a future date'
    }
  },
  eventEndDate: {
    type: Date,
    validate: {
      validator: function(v) {
        return !this.eventDate || !v || v > this.eventDate;
      },
      message: 'Event end date must be after start date'
    }
  },
  eventLocation: {
    type: String,
    trim: true
  },
  attendingCount: { 
    type: Number, 
    default: 0,
    min: 0
  },
  maxAttendees: {
    type: Number,
    min: 1
  },
  isFree: { 
    type: Boolean, 
    default: false 
  },
  eventType: { 
    type: String, 
    enum: ['academic', 'social', 'sports', 'cultural', 'other'] 
  },
  
  // 💻 Tech Gadgets specific fields
  specs: {
    processor: String,
    ram: String,
    storage: String,
    screenSize: String,
    batteryLife: String,
    warranty: String
  },
  
  // ♻️ Second Hand specific fields
  usageDuration: {
    type: String,
    trim: true
  },
  originalPurchaseDate: Date,
  hasOriginalBox: { 
    type: Boolean, 
    default: false 
  },
  hasReceipt: { 
    type: Boolean, 
    default: false 
  },
  
  // 🏠 Home & Furniture specific fields
  dimensions: {
    width: Number,
    height: Number,
    depth: Number,
    unit: { 
      type: String, 
      default: 'cm',
      enum: ['cm', 'm', 'in', 'ft']
    }
  },
  material: {
    type: String,
    trim: true
  },
  requiresAssembly: { 
    type: Boolean, 
    default: false 
  },
  color: {
    type: String,
    trim: true
  },
  
  // 🏫 Campus Life specific fields
  organizer: {
    type: String,
    trim: true
  },
  contactEmail: {
    type: String,
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address']
  },
  contactPhone: {
    type: String,
    trim: true
  },
  website: {
    type: String,
    trim: true
  },
  
  // ==================== TIMESTAMPS ====================
  approvedAt: Date,
  rejectedAt: Date,
  
}, { 
  timestamps: true,  // Automatically adds createdAt and updatedAt
  collection: 'listings' // Explicitly set collection name
});

// ==================== INDEXES ====================
// Text search indexes
listingSchema.index({ title: 'text', description: 'text', tags: 'text' });

// Compound indexes for common queries
listingSchema.index({ status: 1, isActive: 1, createdAt: -1 });
listingSchema.index({ category: 1, status: 1, isActive: 1 });
listingSchema.index({ userType: 1, status: 1, isActive: 1 });
listingSchema.index({ price: 1, status: 1, isActive: 1 });
listingSchema.index({ discount: -1, status: 1, isActive: 1 });
listingSchema.index({ views: -1, status: 1, isActive: 1 });

// Event-specific indexes
listingSchema.index({ eventDate: 1, status: 1, isActive: 1 });

// Flash deal indexes
listingSchema.index({ isFlashDeal: 1, flashDealExpiry: 1, discount: -1 });

// ==================== VIRTUALS ====================

// Check if listing is a flash deal and still active
listingSchema.virtual('isFlashDealActive').get(function() {
  if (!this.isFlashDeal) return false;
  if (!this.flashDealExpiry) return this.discount > 0;
  return this.flashDealExpiry > new Date();
});

// Check if event is upcoming
listingSchema.virtual('isUpcomingEvent').get(function() {
  if (this.category !== 'Events') return false;
  if (!this.eventDate) return false;
  return this.eventDate > new Date();
});

// Calculate discounted price
listingSchema.virtual('discountedPrice').get(function() {
  if (!this.discount || this.discount === 0) return this.price;
  return this.price * (1 - this.discount / 100);
});

// Check if event has available spots
listingSchema.virtual('hasAvailableSpots').get(function() {
  if (this.category !== 'Events') return false;
  if (!this.maxAttendees) return true;
  return this.attendingCount < this.maxAttendees;
});

// ==================== METHODS ====================

// Increment view count
listingSchema.methods.incrementViews = async function() {
  this.views = (this.views || 0) + 1;
  return this.save();
};

// Increment attending count (for events)
listingSchema.methods.incrementAttending = async function() {
  if (this.category !== 'Events') {
    throw new Error('This method is only for events');
  }
  if (this.maxAttendees && this.attendingCount >= this.maxAttendees) {
    throw new Error('Event is full');
  }
  this.attendingCount = (this.attendingCount || 0) + 1;
  return this.save();
};

// Mark as sold
listingSchema.methods.markAsSold = async function() {
  this.status = 'sold';
  this.isActive = false;
  return this.save();
};

// ==================== STATICS ====================

// Find active listings
listingSchema.statics.findActive = function() {
  return this.find({ status: 'active', isActive: true });
};

// Find flash deals
listingSchema.statics.findFlashDeals = function(limit = 10) {
  return this.find({
    status: 'active',
    isActive: true,
    isFlashDeal: true,
    discount: { $gt: 0 },
    $or: [
      { flashDealExpiry: { $exists: false } },
      { flashDealExpiry: { $gt: new Date() } }
    ]
  }).sort({ discount: -1 }).limit(limit);
};

// Find trending items
listingSchema.statics.findTrending = function(limit = 10) {
  return this.find({ status: 'active', isActive: true })
    .sort({ views: -1, sales: -1, createdAt: -1 })
    .limit(limit);
};

// Find by category
listingSchema.statics.findByCategory = function(category, limit = 20, page = 1) {
  const skip = (page - 1) * limit;
  return this.find({
    status: 'active',
    isActive: true,
    category: category
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Get dashboard stats
listingSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        active: { $sum: { $cond: [{ $and: [{ $eq: ['$isActive', true] }, { $eq: ['$status', 'active'] }] }, 1, 0] } },
        sold: { $sum: { $cond: [{ $eq: ['$status', 'sold'] }, 1, 0] } },
        rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
        archived: { $sum: { $cond: [{ $eq: ['$status', 'archived'] }, 1, 0] } },
        totalValue: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, '$price', 0] } },
        students: { $sum: { $cond: [{ $eq: ['$userType', 'student'] }, 1, 0] } },
        vendors: { $sum: { $cond: [{ $eq: ['$userType', 'vendor'] }, 1, 0] } }
      }
    }
  ]);
  
  return stats[0] || {
    total: 0,
    pending: 0,
    active: 0,
    sold: 0,
    rejected: 0,
    archived: 0,
    totalValue: 0,
    students: 0,
    vendors: 0
  };
};

// ==================== MIDDLEWARE ====================

// Update timestamps on status change
listingSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    if (this.status === 'active') {
      this.approvedAt = new Date();
    } else if (this.status === 'rejected') {
      this.rejectedAt = new Date();
    }
  }
  next();
});

// Ensure flash deal has discount
listingSchema.pre('save', function(next) {
  if (this.isFlashDeal && this.discount === 0) {
    this.discount = 10; // Default 10% discount if not specified
  }
  next();
});

// ==================== EXPORT ====================

// Check if model already exists to prevent OverwriteModelError
const Listing = mongoose.models.Listing || mongoose.model('Listing', listingSchema);

console.log('✅ Listing model created/loaded successfully');
console.log('   - Model name:', Listing.modelName);
console.log('   - Collection:', Listing.collection.name);
console.log('   - Listing.find is a function:', typeof Listing.find === 'function');
console.log('   - Listing.findByIdAndUpdate is a function:', typeof Listing.findByIdAndUpdate === 'function');

module.exports = Listing;