
// Flash Deal controller with basic functionality
const mongoose = require('mongoose');

const flashDealSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: false },
  title: { type: String, trim: true },
  image: { type: String },
  price: { type: Number, required: true, min: 0 },
  oldPrice: { type: Number, min: 0 },
  discount: { type: Number, min: 0, max: 100, default: 0 },
  expiresAt: { type: Date, required: true },
  stock: { type: Number, default: 1, min: 0 },
  claimed: { type: Number, default: 0, min: 0 },
  isActive: { type: Boolean, default: true },
}, {
  timestamps: true,
});

flashDealSchema.index({ isActive: 1, expiresAt: 1, discount: -1 });

module.exports = mongoose.model('FlashDeal', flashDealSchema);