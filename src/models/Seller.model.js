const mongoose = require('mongoose');

const SellerSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  shopName:    { type: String, required: true, trim: true },
  avatar:      { type: String, default: '' },
  bio:         { type: String, default: '' },
  rating:      { type: Number, default: 0 },
  numReviews:  { type: Number, default: 0 },
  totalSales:  { type: Number, default: 0 },
  badge:       { type: String, default: '' },           // Top Seller, Verified, Rising Star
  isVerified:  { type: Boolean, default: false },
  university:  { type: String, default: '' },
  hall:        { type: String, default: '' },
  momoNumber:  { type: String, default: '' },
  isActive:    { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Seller', SellerSchema);
