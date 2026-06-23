const mongoose = require('mongoose');

const { Schema } = mongoose;

const MessageSchema = new Schema({
  conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  sender: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  text: { type: String, required: true },
  type: { type: String, enum: ['text', 'image', 'offer', 'system'], default: 'text' },
  imageUrl: { type: String },
  read: { type: Boolean, default: false },
  readAt: { type: Date },
  timestamp: { type: Date, default: Date.now, index: true },
  // optional client/federation id to deduplicate across systems
  firebaseId: { type: String, index: true, unique: false, sparse: true },
}, { timestamps: false });

// Index to support conversation queries ordered by time
MessageSchema.index({ conversation: 1, timestamp: -1 });

module.exports = mongoose.model('Message', MessageSchema);
