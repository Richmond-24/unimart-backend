
const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema(
{
  // ==================== SELLER INFORMATION ====================
  businessName: String,

  sellerName: {
    type: String,
    required: true
  },

  sellerEmail: {
    type: String,
    required: true
  },

  sellerPhone: String,
  location: String,

  userType: {
    type: String,
    enum: ['student', 'vendor'],
    default: 'student'
  },

  // ==================== PRODUCT INFORMATION ====================

  title: {
    type: String,
    required: true
  },

  description: String,

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
    required: true
  },

  subcategory: String,
  brand: String,

  condition: {
    type: String,
    enum: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
    default: 'New'
  },

  conditionNotes: String,

  price: {
    type: Number,
    required: true
  },

  discount: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },

  edition: String,

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

  tags: [String],
  imageUrls: [String],
  confidence: Number,

  // ==================== APPROVAL ====================

  status: {
    type: String,
    enum: ['pending', 'active', 'sold', 'archived', 'rejected'],
    default: 'pending'
  },

  isActive: {
    type: Boolean,
    default: false
  },

  // ==================== ADMIN ====================

  adminNotes: String,
  rejectionReason: String,

  featured: {
    type: Boolean,
    default: false
  },

  // ==================== ANALYTICS ====================

  views: {
    type: Number,
    default: 0
  },

  sales: {
    type: Number,
    default: 0
  },

  // ==================== FLASH DEAL ====================

  isFlashDeal: {
    type: Boolean,
    default: false
  },

  flashDealExpiry: Date,

  // ==================== FOOD ====================

  preparationTime: String,
  deliveryFee: Number,
  chef: String,
  cuisine: String,

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

  // ==================== SERVICES ====================

  providerName: String,
  serviceAvailability: String,
  serviceDuration: String,

  onlineAvailable: {
    type: Boolean,
    default: false
  },

  qualifications: [String],

  // ==================== EVENTS ====================

  eventDate: Date,
  eventEndDate: Date,
  eventLocation: String,

  attendingCount: {
    type: Number,
    default: 0
  },

  maxAttendees: Number,

  isFree: {
    type: Boolean,
    default: false
  },

  eventType: {
    type: String,
    enum: ['academic', 'social', 'sports', 'cultural', 'other']
  },

  // ==================== TECH GADGETS ====================

  specs: {
    processor: String,
    ram: String,
    storage: String,
    screenSize: String,
    batteryLife: String,
    warranty: String
  },

  // ==================== SECOND HAND ====================

  usageDuration: String,
  originalPurchaseDate: Date,

  hasOriginalBox: {
    type: Boolean,
    default: false
  },

  hasReceipt: {
    type: Boolean,
    default: false
  },

  // ==================== HOME & FURNITURE ====================

  dimensions: {
    width: Number,
    height: Number,
    depth: Number,

    unit: {
      type: String,
      default: 'cm'
    }
  },

  material: String,

  requiresAssembly: {
    type: Boolean,
    default: false
  },

  color: String,

  // ==================== CAMPUS LIFE ====================

  organizer: String,
  contactEmail: String,
  contactPhone: String,
  website: String,

  // ==================== TIMESTAMPS ====================

  approvedAt: Date,
  rejectedAt: Date

},
{
  timestamps: true,
  collection: 'listings'
}
);



// ==================== INDEXES ====================

listingSchema.index({ title: 'text', description: 'text', tags: 'text' });

listingSchema.index({ status: 1, isActive: 1, createdAt: -1 });
listingSchema.index({ category: 1, status: 1, isActive: 1 });
listingSchema.index({ price: 1, status: 1, isActive: 1 });



// ==================== VIRTUALS ====================

listingSchema.virtual('discountedPrice').get(function () {

  if (!this.discount || this.discount === 0) {
    return this.price;
  }

  return this.price * (1 - this.discount / 100);

});



listingSchema.virtual('isFlashDealActive').get(function () {

  if (!this.isFlashDeal) return false;

  if (!this.flashDealExpiry) return this.discount > 0;

  return this.flashDealExpiry > new Date();

});



// ==================== METHODS ====================

listingSchema.methods.incrementViews = async function () {

  this.views = (this.views || 0) + 1;

  return this.save();

};



listingSchema.methods.markAsSold = async function () {

  this.status = 'sold';
  this.isActive = false;

  return this.save();

};



// ==================== STATICS ====================

listingSchema.statics.findActive = function () {

  return this.find({
    status: 'active',
    isActive: true
  });

};



listingSchema.statics.findFlashDeals = function (limit = 10) {

  return this.find({
    status: 'active',
    isActive: true,
    isFlashDeal: true,
    discount: { $gt: 0 }
  })
  .sort({ discount: -1 })
  .limit(limit);

};



// ==================== MIDDLEWARE ====================

// Update timestamps when status changes

listingSchema.pre('save', async function () {

  if (this.isModified('status')) {

    if (this.status === 'active') {
      this.approvedAt = new Date();
    }

    if (this.status === 'rejected') {
      this.rejectedAt = new Date();
    }

  }

});



// Ensure flash deal has discount

listingSchema.pre('save', async function () {

  if (this.isFlashDeal && this.discount === 0) {

    this.discount = 10;

  }

});



// ==================== EXPORT ====================

const Listing =
  mongoose.models.Listing ||
  mongoose.model('Listing', listingSchema);

console.log('✅ Listing model loaded');

module.exports = Listing;