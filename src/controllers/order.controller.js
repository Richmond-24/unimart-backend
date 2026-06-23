const Order = require('../models/Order.model');
const Cart  = require('../models/Cart.model');
const Product = require('../models/Product.model');

// @route POST /api/orders
exports.createOrder = async (req, res, next) => {
  try {
    const { items, deliveryAddress, paymentMethod, deliveryFee = 5 } = req.body;

    // Validate stock & build items
    const orderItems = [];
    let subtotal = 0;
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product || !product.isActive)
        return res.status(400).json({ success: false, message: `Product ${item.productId} unavailable` });
      if (product.stock < item.quantity)
        return res.status(400).json({ success: false, message: `Insufficient stock for ${product.title}` });

      orderItems.push({ product: product._id, title: product.title,
        image: product.images[0] || '', price: product.price,
        quantity: item.quantity, seller: product.seller });
      subtotal += product.price * item.quantity;
    }

    const order = await Order.create({
      buyer: req.user._id, items: orderItems,
      subtotal, deliveryFee, total: subtotal + deliveryFee,
      deliveryAddress, paymentMethod,
    });

    // Decrement stock
    for (const item of items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: -item.quantity, sold: item.quantity },
      });
    }

    // Clear cart after successful order
    await Cart.findOneAndUpdate({ user: req.user._id }, { items: [], total: 0 });

    res.status(201).json({ success: true, data: order });
  } catch (err) { next(err); }
};

// @route GET /api/orders
exports.getMyOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const query = { buyer: req.user._id };
    if (status) query.status = status;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      Order.find(query).sort('-createdAt').skip(skip).limit(Number(limit)),
      Order.countDocuments(query),
    ]);
    res.json({ success: true, total, page: Number(page), pages: Math.ceil(total / limit), data });
  } catch (err) { next(err); }
};

// @route GET /api/orders/:id
exports.getOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.buyer.toString() !== req.user._id.toString() && req.user.role !== 'admin')
      return res.status(403).json({ success: false, message: 'Not authorised' });
    res.json({ success: true, data: order });
  } catch (err) { next(err); }
};

// @route PATCH /api/orders/:id/status  (admin/seller)
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(req.params.id,
      { status, ...(status === 'delivered' && { deliveredAt: new Date() }) },
      { new: true }
    );
    if (!order) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: order });
  } catch (err) { next(err); }
};

// @route PATCH /api/orders/:id/pay
exports.markAsPaid = async (req, res, next) => {
  try {
    const { paymentRef } = req.body;
    const order = await Order.findByIdAndUpdate(req.params.id,
      { paymentStatus: 'paid', paymentRef },
      { new: true }
    );
    if (!order) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: order });
  } catch (err) { next(err); }
};
