const Cart = require('../models/Cart.model');
const Product = require('../models/Product.model');

// @route GET /api/cart
exports.getCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id })
      .populate('items.product', 'title images price stock isActive seller');
    if (!cart) return res.json({ success: true, data: { items: [], total: 0 } });
    res.json({ success: true, data: cart });
  } catch (err) { next(err); }
};

// @route POST /api/cart/add
exports.addToCart = async (req, res, next) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const product = await Product.findById(productId);
    if (!product || !product.isActive)
      return res.status(404).json({ success: false, message: 'Product not available' });
    if (product.stock < quantity)
      return res.status(400).json({ success: false, message: 'Insufficient stock' });

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) cart = new Cart({ user: req.user._id, items: [] });

    const existing = cart.items.find(i => i.product.toString() === productId);
    if (existing) existing.quantity += quantity;
    else          cart.items.push({ product: productId, quantity, price: product.price });

    await cart.save();
    res.json({ success: true, data: cart, itemCount: cart.items.length });
  } catch (err) { next(err); }
};

// @route PUT /api/cart/update
exports.updateCartItem = async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

    const item = cart.items.find(i => i.product.toString() === productId);
    if (!item) return res.status(404).json({ success: false, message: 'Item not in cart' });

    if (quantity <= 0) cart.items = cart.items.filter(i => i.product.toString() !== productId);
    else               item.quantity = quantity;

    await cart.save();
    res.json({ success: true, data: cart });
  } catch (err) { next(err); }
};

// @route DELETE /api/cart/:productId
exports.removeFromCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });
    cart.items = cart.items.filter(i => i.product.toString() !== req.params.productId);
    await cart.save();
    res.json({ success: true, data: cart });
  } catch (err) { next(err); }
};

// @route DELETE /api/cart/clear
exports.clearCart = async (req, res, next) => {
  try {
    await Cart.findOneAndUpdate({ user: req.user._id }, { items: [], total: 0 });
    res.json({ success: true, message: 'Cart cleared' });
  } catch (err) { next(err); }
};
