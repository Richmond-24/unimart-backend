const mongoose = require('mongoose');

const { Schema } = mongoose;

const ConversationSchema = new Schema({
  participants: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
  product: { type: Schema.Types.ObjectId, ref: 'Product' },
  productName: { type: String },
  productImage: { type: String },
  price: { type: Number },
  buyer: {
    id: { type: Schema.Types.ObjectId, ref: 'User' },
    name: String,
    photoURL: String,
  },
  seller: {
    id: { type: Schema.Types.ObjectId, ref: 'User' },
    name: String,
    photoURL: String,
  },
  lastMessage: {
    text: String,
    senderId: { type: Schema.Types.ObjectId, ref: 'User' },
    timestamp: Date,
  },
  // Map of userId -> unread count
  unreadCount: {
    type: Map,
    of: Number,
    default: {},
  },
  status: {
    type: String,
    enum: ['active', 'archived', 'blocked'],
    default: 'active',
  },
}, { timestamps: true });

// Compound index to speed up lookups by participants and ordering
ConversationSchema.index({ participants: 1, updatedAt: -1 });

// Ensure timestamps are updated
ConversationSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  if (!this.createdAt) this.createdAt = new Date();
  next();
});

module.exports = mongoose.model('Conversation', ConversationSchema);
