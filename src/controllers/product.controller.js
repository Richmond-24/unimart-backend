
const Product = require('../models/Product.model');
const Listing = require('../models/Listing');
const User = require('../models/User.model');
const Category = require('../models/Category.model');

const normalizeListingCategory = (categoryName) => {
  if (!categoryName) return 'Other';
  const normalized = String(categoryName).trim().toLowerCase();
  if (normalized.includes('electronics') || normalized.includes('gadget')) return 'Tech Gadgets';
  if (normalized.includes('fashion') || normalized.includes('apparel') || normalized.includes('clothing')) return 'Fashion';
  if (normalized.includes('book')) return 'Books';
  if (normalized.includes('food') || normalized.includes('meal') || normalized.includes('dining')) return 'Food';
  if (normalized.includes('service')) return 'Services';
  if (normalized.includes('event')) return 'Events';
  if (normalized.includes('second') || normalized.includes('used') || normalized.includes('preowned')) return 'Second Hand';
  if (normalized.includes('home') || normalized.includes('furniture')) return 'Home & Furniture';
  if (normalized.includes('campus') || normalized.includes('college') || normalized.includes('university')) return 'Campus Life';
  return 'Other';
};

const syncProductToListing = async (product) => {
  try {
    const seller = await User.findById(product.seller).lean();
    const categoryDoc = await Category.findById(product.category).lean().catch(() => null);
    const listingCategory = normalizeListingCategory(categoryDoc?.name || 'Other');

    const payload = {
      productId: product._id,
      title: product.name,
      description: product.description || '',
      price: product.price || 0,
      imageUrls: Array.isArray(product.images) ? product.images : [],
      category: listingCategory,
      sellerEmail: seller?.email || '',
      sellerName: seller?.name || 'Unknown Seller',
      sellerPhone: seller?.phone || '',
      status: 'active',
      isActive: true,
      featured: false,
      tags: [],
      views: 0,
      sales: 0,
      approvedAt: new Date(),
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };

    const existingListing = await Listing.findOne({ productId: product._id });
    if (existingListing) {
      Object.assign(existingListing, payload);
      return existingListing.save();
    }

    return Listing.create(payload);
  } catch (err) {
    console.error('Failed to sync approved product to listing:', err);
    return null;
  }
};

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

    await syncProductToListing(product);

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

    const listing = await Listing.findOne({ productId: product._id });
    if (listing) {
      listing.isActive = false;
      listing.status = 'archived';
      await listing.save();
    }

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