// ─── Food Controller ──────────────────────────────────────────────────────────
const Food    = require('../models/Food');
const Service = require('../models/Service');
const Event   = require('../models/Event.model');
const Seller  = require('../models/Seller.model');

// ── FOOD ──────────────────────────────────────────────────────────────────────
exports.getFoods = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, university } = req.query;
    const query = { isAvailable: true };
    if (university) query.university = university;
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      Food.find(query).populate('seller','name avatar').sort('-ordersToday').skip(skip).limit(Number(limit)),
      Food.countDocuments(query),
    ]);
    res.json({ success: true, total, page: Number(page), data });
  } catch (err) { next(err); }
};

exports.getFood = async (req, res, next) => {
  try {
    const data = await Food.findById(req.params.id).populate('seller','name avatar hall university');
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

exports.createFood = async (req, res, next) => {
  try {
    req.body.seller = req.user._id;
    const data = await Food.create(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
};

exports.updateFood = async (req, res, next) => {
  try {
    const food = await Food.findById(req.params.id);
    if (!food) return res.status(404).json({ success: false, message: 'Not found' });
    if (food.seller.toString() !== req.user._id.toString() && req.user.role !== 'admin')
      return res.status(403).json({ success: false, message: 'Not authorised' });
    const data = await Food.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

exports.deleteFood = async (req, res, next) => {
  try {
    const food = await Food.findById(req.params.id);
    if (!food) return res.status(404).json({ success: false, message: 'Not found' });
    if (food.seller.toString() !== req.user._id.toString() && req.user.role !== 'admin')
      return res.status(403).json({ success: false, message: 'Not authorised' });
    await food.deleteOne();
    res.json({ success: true, message: 'Food item removed' });
  } catch (err) { next(err); }
};

// ── SERVICES ─────────────────────────────────────────────────────────────────
exports.getServices = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, category, university } = req.query;
    const query = { isActive: true };
    if (category)   query.category   = category;
    if (university) query.university = university;
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      Service.find(query).populate('seller','name avatar').sort('-rating').skip(skip).limit(Number(limit)),
      Service.countDocuments(query),
    ]);
    res.json({ success: true, total, page: Number(page), data });
  } catch (err) { next(err); }
};

exports.getService = async (req, res, next) => {
  try {
    const data = await Service.findById(req.params.id).populate('seller','name avatar hall university');
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

exports.createService = async (req, res, next) => {
  try {
    req.body.seller = req.user._id;
    const data = await Service.create(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
};

exports.updateService = async (req, res, next) => {
  try {
    const svc = await Service.findById(req.params.id);
    if (!svc) return res.status(404).json({ success: false, message: 'Not found' });
    if (svc.seller.toString() !== req.user._id.toString() && req.user.role !== 'admin')
      return res.status(403).json({ success: false, message: 'Not authorised' });
    const data = await Service.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

exports.deleteService = async (req, res, next) => {
  try {
    const svc = await Service.findById(req.params.id);
    if (!svc) return res.status(404).json({ success: false, message: 'Not found' });
    if (svc.seller.toString() !== req.user._id.toString() && req.user.role !== 'admin')
      return res.status(403).json({ success: false, message: 'Not authorised' });
    await svc.deleteOne();
    res.json({ success: true, message: 'Service removed' });
  } catch (err) { next(err); }
};

// ── EVENTS ────────────────────────────────────────────────────────────────────
exports.getEvents = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, university } = req.query;
    const query = { isActive: true, date: { $gte: new Date() } };
    if (university) query.university = university;
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      Event.find(query).populate('organizer','name avatar').sort('date').skip(skip).limit(Number(limit)),
      Event.countDocuments(query),
    ]);
    res.json({ success: true, total, page: Number(page), data });
  } catch (err) { next(err); }
};

exports.getEvent = async (req, res, next) => {
  try {
    const data = await Event.findById(req.params.id).populate('organizer','name avatar');
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

exports.createEvent = async (req, res, next) => {
  try {
    req.body.organizer = req.user._id;
    const data = await Event.create(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
};

exports.rsvpEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Not found' });
    const already = event.rsvpList.includes(req.user._id);
    if (already) {
      event.rsvpList = event.rsvpList.filter(u => u.toString() !== req.user._id.toString());
      event.attending = Math.max(0, event.attending - 1);
    } else {
      event.rsvpList.push(req.user._id);
      event.attending += 1;
    }
    await event.save();
    res.json({ success: true, rsvped: !already, attending: event.attending });
  } catch (err) { next(err); }
};

// ── SELLERS ───────────────────────────────────────────────────────────────────
exports.getSellers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, university } = req.query;
    const query = { isActive: true };
    if (university) query.university = university;
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      Seller.find(query).populate('user','name avatar email').sort('-rating').skip(skip).limit(Number(limit)),
      Seller.countDocuments(query),
    ]);
    res.json({ success: true, total, page: Number(page), data });
  } catch (err) { next(err); }
};

exports.getSeller = async (req, res, next) => {
  try {
    const Listing = require('../models/Listing');
    const data = await Seller.findById(req.params.id).populate('user','name avatar email university hall');
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });
    
    // Fetch seller's listings (products from Listing model)
    const products = await Listing.find({ 
      sellerEmail: data.user.email, 
      status: 'active',
      isActive: true 
    })
      .sort({ createdAt: -1 })
      .limit(50);
    
    res.json({ success: true, data: { ...data.toObject(), products } });
  } catch (err) { next(err); }
};

// Get seller profile for current authenticated user
exports.getSellerMe = async (req, res, next) => {
  try {
    const Listing = require('../models/Listing');
    const data = await Seller.findOne({ user: req.user._id }).populate('user','name avatar email university hall');
    if (!data) return res.status(404).json({ success: false, message: 'Seller profile not found' });

    const products = await Listing.find({ 
      sellerEmail: data.user.email, 
      status: 'active',
      isActive: true
    }).sort({ createdAt: -1 }).limit(50);

    // Aggregate simple stats from listings for seller dashboard
    const stats = {
      totalProducts: products.length,
      activeProducts: products.filter(p => p.isActive).length,
      totalViews: products.reduce((acc, p) => acc + (p.views || 0), 0),
      totalSales: products.reduce((acc, p) => acc + (p.sales || 0), 0),
      revenue: products.reduce((acc, p) => acc + ((p.price || 0) * (p.sales || 0)), 0),
    };

    res.json({ success: true, data: { ...data.toObject(), products, stats } });
  } catch (err) { next(err); }
};

exports.updateSellerProfile = async (req, res, next) => {
  try {
    const data = await Seller.findOneAndUpdate(
      { user: req.user._id }, req.body, { new: true, runValidators: true }
    );
    if (!data) return res.status(404).json({ success: false, message: 'Seller profile not found' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
};
