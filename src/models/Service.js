const mongoose = require('mongoose');

const ServiceSchema = new mongoose.Schema({
  title:        { type: String, required: true, trim: true },
  provider:     { type: String, required: true },
  seller:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  price:        { type: Number, required: true },
  oldPrice:     { type: Number, default: 0 },
  discount:     { type: Number, default: 0 },
  image:        { type: String, default: '' },
  rating:       { type: Number, default: 0 },
  numReviews:   { type: Number, default: 0 },
  badge:        { type: String, default: '' },
  location:     { type: String, default: '' },
  availability: { type: String, default: 'Flexible' },
  description:  { type: String, default: '' },
  category:     { type: String, enum: ['beauty','tutoring','photography','cleaning','tech','other'],
                  default: 'other' },
  isActive:     { type: Boolean, default: true },
  university:   { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Service', ServiceSchema);
