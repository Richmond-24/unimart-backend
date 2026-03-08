
// models/Listing.js
const mongoose = require('mongoose');

const ListingSchema = new mongoose.Schema({
  // Seller info
  businessName: String,
  sellerName: { type: String, required: true },
  sellerEmail: { type: String, required: true },
  sellerPhone: { type: String, required: true },
  location: { type: String, required: true },
  userType: { 
    type: String, 
    enum: ['student', 'vendor'], 
    required: true 
  },
  
  // Product info
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  brand: String,
  condition: { 
    type: String, 
    enum: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
    required: true 
  },
  conditionNotes: String,
  price: { type: Number, required: true },
  discount: { type: Number, min: 0, max: 100 },
  edition: String,
  
  // Delivery & payment
  deliveryType: { 
    type: String, 
    enum: ['self', 'unimart'],
    required: true 
  },
  paymentMethod: { 
    type: String, 
    enum: ['mtn', 'telecel'],
    required: true 
  },
  
  // Metadata
  tags: [String],
  imageUrls: [String],
  confidence: Number,
  status: { 
    type: String, 
    enum: ['active', 'sold', 'archived'],
    default: 'active' 
  },
  
  // Admin fields
  adminNotes: String,
  featured: { type: Boolean, default: false }
}, {
  timestamps: true
});

// Create indexes
ListingSchema.index({ status: 1, createdAt: -1 });
ListingSchema.index({ sellerEmail: 1 });
ListingSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Listing', ListingSchema);