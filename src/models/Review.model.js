const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetType: { type: String, enum: ['product','seller','service','food'], required: true },
  targetId:   { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'targetType' },
  rating:     { type: Number, required: true, min: 1, max: 5 },
  comment:    { type: String, default: '' },
  images:     [{ type: String }],
}, { timestamps: true });

// One review per user per target
ReviewSchema.index({ user: 1, targetType: 1, targetId: 1 }, { unique: true });

module.exports = mongoose.model('Review', ReviewSchema);
