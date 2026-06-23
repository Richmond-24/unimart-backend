const FlashDeal = require('../models/FlashDeal.model');
const Review    = require('../models/Review.model');
const Product   = require('../models/Product.model');

// ── FLASH DEALS ───────────────────────────────────────────────────────────────
exports.getFlashDeals = async (req, res, next) => {
  try {
    const data = await FlashDeal.find({
      isActive: true,
      expiresAt: { $gt: new Date() },
      $expr: { $lt: ['$claimed', '$stock'] },
    }).populate('product', 'title images seller').sort('expiresAt').limit(10);

    // Add countdown (seconds remaining) to each deal
    const now = Date.now();
    const enriched = data.map(d => ({
      ...d.toObject(),
      secondsLeft: Math.max(0, Math.floor((d.expiresAt - now) / 1000)),
    }));

    res.json({ success: true, data: enriched });
  } catch (err) { next(err); }
};

exports.createFlashDeal = async (req, res, next) => {
  try {
    const data = await FlashDeal.create(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
};

exports.claimFlashDeal = async (req, res, next) => {
  try {
    const deal = await FlashDeal.findById(req.params.id);
    if (!deal || !deal.isActive || deal.expiresAt < new Date())
      return res.status(400).json({ success: false, message: 'Deal expired or unavailable' });
    if (deal.claimed >= deal.stock)
      return res.status(400).json({ success: false, message: 'Deal sold out' });

    deal.claimed += 1;
    if (deal.claimed >= deal.stock) deal.isActive = false;
    await deal.save();

    res.json({ success: true, message: 'Deal claimed!', data: deal });
  } catch (err) { next(err); }
};

// ── REVIEWS ───────────────────────────────────────────────────────────────────
exports.getReviews = async (req, res, next) => {
  try {
    const { targetType, targetId, page = 1, limit = 20 } = req.query;
    const query = {};
    if (targetType) query.targetType = targetType;
    if (targetId)   query.targetId   = targetId;
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      Review.find(query).populate('user','name avatar').sort('-createdAt').skip(skip).limit(Number(limit)),
      Review.countDocuments(query),
    ]);
    res.json({ success: true, total, page: Number(page), data });
  } catch (err) { next(err); }
};

exports.createReview = async (req, res, next) => {
  try {
    const { targetType, targetId, rating, comment, images } = req.body;
    const existing = await Review.findOne({ user: req.user._id, targetType, targetId });
    if (existing)
      return res.status(400).json({ success: false, message: 'Already reviewed' });

    const review = await Review.create({ user: req.user._id, targetType, targetId, rating, comment, images });

    // Helper: compute average with default baseline of 2 when no reviews
    const computeAvgOrDefault = (arr) => {
      if (!arr || arr.length === 0) return 2.0;
      const avg = arr.reduce((s, r) => s + r.rating, 0) / arr.length;
      return Number(avg.toFixed(1));
    };

    // Update product/listing rating average
    if (targetType === 'product') {
      // update Product model if exists
      try {
        const reviews = await Review.find({ targetType: 'product', targetId });
        const avg = computeAvgOrDefault(reviews);
        await Product.findByIdAndUpdate(targetId, { rating: avg, numReviews: reviews.length });
      } catch (e) {
        // ignore product update errors
      }

      // Also update Listing documents (marketplace) if the id refers to a listing
      try {
        const Listing = require('../models/Listing');
        const listing = await Listing.findById(targetId);
        if (listing) {
          const reviews = await Review.find({ targetType: 'product', targetId });
          const avg = computeAvgOrDefault(reviews);
          await Listing.findByIdAndUpdate(targetId, { rating: avg, reviewCount: reviews.length });

          // Update seller aggregate rating based on product reviews + seller reviews
          const Seller = require('../models/Seller.model');
          const User = require('../models/User');

          // attempt to resolve seller by email or name
          let sellerDoc = null;
          if (listing.sellerEmail) {
            const user = await User.findOne({ email: listing.sellerEmail });
            if (user) sellerDoc = await Seller.findOne({ user: user._id });
          }
          if (!sellerDoc && listing.sellerName) {
            sellerDoc = await Seller.findOne({ shopName: listing.sellerName });
          }

          if (sellerDoc) {
            // find all listings for this seller (by email) and their product reviews
            const sellerListings = await Listing.find({ sellerEmail: listing.sellerEmail }).select('_id');
            const listingIds = sellerListings.map(l => l._id);
            const productReviews = await Review.find({ targetType: 'product', targetId: { $in: listingIds } });
            const sellerReviews = await Review.find({ targetType: 'seller', targetId: sellerDoc._id });
            const all = productReviews.concat(sellerReviews);
            const avg = computeAvgOrDefault(all);
            await Seller.findByIdAndUpdate(sellerDoc._id, { rating: avg, numReviews: all.length });
          }
        }
      } catch (e) {
        // ignore listing/seller update errors
      }
    }

    // If review is directly for a seller, update seller averages
    if (targetType === 'seller') {
      try {
        const Seller = require('../models/Seller.model');
        const seller = await Seller.findById(targetId);
        if (seller) {
          const sellerReviews = await Review.find({ targetType: 'seller', targetId });
          const avg = computeAvgOrDefault(sellerReviews);
          await Seller.findByIdAndUpdate(targetId, { rating: avg, numReviews: sellerReviews.length });
        }
      } catch (e) {
        // ignore
      }
    }

    res.status(201).json({ success: true, data: review });
  } catch (err) { next(err); }
};

exports.deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Not found' });
    if (review.user.toString() !== req.user._id.toString() && req.user.role !== 'admin')
      return res.status(403).json({ success: false, message: 'Not authorised' });
    await review.deleteOne();
    res.json({ success: true, message: 'Review removed' });
  } catch (err) { next(err); }
};
