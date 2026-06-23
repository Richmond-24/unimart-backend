const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  name:     { type: String, required: true, unique: true, trim: true },
  slug:     { type: String, required: true, unique: true, lowercase: true },
  image:    { type: String, default: '' },
  bgColor:  { type: String, default: '#F8F9FA' },
  hint:     { type: String, default: '' },
  icon:     { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  order:    { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Category', CategorySchema);
