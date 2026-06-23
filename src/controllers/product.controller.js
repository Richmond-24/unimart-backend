
const Product = require('../models/Product.model');

// Admin: approve product
exports.approveProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    product.isActive = true;
    product.status = 'active';
    product.approvedAt = new Date();
    product.approvedBy = req.user._id;
    await product.save();
    res.json({ success: true, message: 'Product approved', data: product });
  } catch (err) { next(err); }
};

// Admin: reject product
exports.rejectProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    product.isActive = false;
    product.status = 'archived';
    if (req.body.reason) product.adminNotes = req.body.reason;
    await product.save();
    res.json({ success: true, message: 'Product rejected', data: product });
  } catch (err) { next(err); }
};

// Seller: create new product (seller set from req.user)
exports.createProduct = async (req, res, next) => {
  try {
    const payload = { ...req.body, seller: req.user._id };
    const product = await Product.create(payload);
    // Emit real-time event to the seller's room so dashboards update live
    try {
      const io = req.app && req.app.get && req.app.get('io');
      if (io) {
        const room = `user:${String(req.user._id)}`;
        io.to(room).emit('seller:product_created', product);
      }
    } catch (emitErr) {
      // non-fatal -- log and continue
      console.error('Failed to emit product_created event', emitErr);
    }

    res.json({ success: true, data: product });
  } catch (err) { next(err); }
};

// Seller: get my products
exports.getMyProducts = async (req, res, next) => {
  try {
    const products = await Product.find({ seller: req.user._id });
    res.json({ success: true, data: products });
  } catch (err) { next(err); }
};

// Seller: update product (must own)
exports.updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    if (String(product.seller) !== String(req.user._id)) return res.status(403).json({ success: false, message: 'Not authorized' });
    Object.assign(product, req.body);
    await product.save();
    res.json({ success: true, data: product });
  } catch (err) { next(err); }
};

// Seller: delete product
exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    if (String(product.seller) !== String(req.user._id)) return res.status(403).json({ success: false, message: 'Not authorized' });
    await product.remove();
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) { next(err); }
};