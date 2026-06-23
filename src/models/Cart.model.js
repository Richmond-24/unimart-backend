const mongoose = require('mongoose');

const CartItemSchema = new mongoose.Schema({
  product:  { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, default: 1, min: 1 },
  price:    { type: Number, required: true },
});

const CartSchema = new mongoose.Schema({
  user:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  items: [CartItemSchema],
  total: { type: Number, default: 0 },
}, { timestamps: true });

// Auto-calc total before save
CartSchema.pre('save', function (next) {
  this.total = this.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  next();
});

module.exports = mongoose.model('Cart', CartSchema);
