const Product   = require('../models/Product.model');
const Category  = require('../models/Category.model');
const Food      = require('../models/Food.model');
const Service   = require('../models/Service.model');
const Event     = require('../models/Event.model');
const Seller    = require('../models/Seller.model');
const FlashDeal = require('../models/FlashDeal.model');

// @route GET /api/home
// Returns everything the home screen needs in a single request
exports.getHomeFeed = async (req, res, next) => {
  try {
    const university = req.query.university || '';
    const uniFilter  = university ? { university } : {};
    const now        = new Date();

    const [
      categories,
      trending,
      flashDeals,
      usedItems,
      services,
      foods,
      events,
      sellers,
      techGadgets,
    ] = await Promise.all([
      // Categories
      Category.find({ isActive: true }).sort('order').limit(12),

      // Trending products
      Product.find({ isTrending: true, isActive: true, ...uniFilter })
        .populate('seller','name avatar').sort('-sold').limit(10)
        .select('title price oldPrice images rating sold seller'),

      // Flash deals
      FlashDeal.find({ isActive: true, expiresAt: { $gt: now }, $expr: { $lt: ['$claimed','$stock'] } })
        .sort('expiresAt').limit(6).select('title image price oldPrice discount expiresAt claimed stock'),

      // Used / second-hand
      Product.find({ isUsed: true, isActive: true, ...uniFilter })
        .populate('seller','name avatar').sort('-createdAt').limit(8)
        .select('title price oldPrice discount images condition seller'),

      // Student services
      Service.find({ isActive: true, ...uniFilter })
        .populate('seller','name avatar').sort('-rating').limit(8)
        .select('title provider price oldPrice discount image rating badge location availability'),

      // Food
      Food.find({ isAvailable: true, ...uniFilter })
        .populate('seller','name avatar').sort('-ordersToday').limit(8)
        .select('title chef price deliveryFee image rating time badge ordersToday'),

      // Events (upcoming only)
      Event.find({ isActive: true, date: { $gte: now }, ...uniFilter })
        .populate('organizer','name avatar').sort('date').limit(8)
        .select('title location date dateLabel price isFree image badge attending'),

      // Top sellers
      Seller.find({ isActive: true, ...uniFilter })
        .populate('user','name avatar').sort('-rating').limit(8)
        .select('shopName avatar rating numReviews totalSales badge isVerified user'),

      // Tech gadgets (category slug: electronics)
      Product.find({ isActive: true, ...uniFilter })
        .populate('category','name slug').populate('seller','name')
        .sort('-rating').limit(8)
        .select('title price oldPrice discount images rating numReviews badge seller category tags'),
    ]);

    // Add secondsLeft to flash deals
    const flashWithCountdown = flashDeals.map(d => ({
      ...d.toObject(),
      secondsLeft: Math.max(0, Math.floor((d.expiresAt - now) / 1000)),
    }));

    // Banners — could be DB-driven; hardcoded fallback for now
    const banners = [
      { id: 'b1', title: '🇬🇭 Ghana Independence Sale!', desc: 'Up to 60% off on trending items',              cta: 'Shop Now',   color: '#FF6A00' },
      { id: 'b2', title: '📚 Exam Season Deals',          desc: 'Textbooks & stationery at 40% off',            cta: 'Shop Books', color: '#8B5CF6' },
      { id: 'b3', title: '🎓 Freshers Welcome',           desc: 'Special discounts for new students',           cta: 'Claim Offer',color: '#10B981' },
      { id: 'b4', title: '💻 Tech Gadgets Sale',          desc: 'Up to 40% off headphones, speakers & more',   cta: 'Shop Tech',  color: '#8B5CF6' },
    ];

    res.json({
      success: true,
      data: {
        banners,
        categories,
        trending,
        flashDeals: flashWithCountdown,
        usedItems,
        services,
        foods,
        events,
        sellers,
        techGadgets,
      },
    });
  } catch (err) { next(err); }
};
