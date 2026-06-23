const mongoose = require('mongoose');

const FoodSchema = new mongoose.Schema({
  title:        { type: String, required: true, trim: true },
  chef:         { type: String, required: true },
  seller:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  price:        { type: Number, required: true },
  deliveryFee:  { type: Number, default: 3 },
  image:        { type: String, default: '' },
  rating:       { type: Number, default: 0 },
  numReviews:   { type: Number, default: 0 },
  deliveryTime: { type: String, default: '20-30 min' },  // e.g. "20-30 min"
  badge:        { type: String, default: '' },            // Popular, Best Seller, etc.
  ordersToday:  { type: Number, default: 0 },
  isAvailable:  { type: Boolean, default: true },
  ingredients:  [{ type: String }],
  university:   { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Food', FoodSchema);
