const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    title:   { type: String, required: true },
    image:   { type: String, default: '' },
    price:   { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    seller:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    buyer:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items:    [OrderItemSchema],

    subtotal:     { type: Number, required: true },
    deliveryFee:  { type: Number, default: 5 },
    total:        { type: Number, required: true },

    deliveryAddress: {
      street:    { type: String, default: '' },
      city:      { type: String, default: '' },
      state:     { type: String, default: '' },
      zip:       { type: String, default: '' },
      country:   { type: String, default: '' },
    },

    paymentMethod:  { type: String, default: 'paystack' },
    paymentStatus:  { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
    paymentRef:     { type: String, default: '' },

    status: { type: String, enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'], default: 'pending' },

    deliveredAt: { type: Date },
    cancelledAt: { type: Date },
    cancelReason: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', OrderSchema);
