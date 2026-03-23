
// backend/server.js
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const dotenv   = require('dotenv');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Zapier webhook ────────────────────────────────────────────────────────────
const ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/26725705/ux4gb6x/';

// ── CORS ──────────────────────────────────────────────────────────────────────
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const ADMIN_URL    = process.env.ADMIN_URL    || 'http://localhost:3001';

// Add all allowed origins
const allowedOrigins = [
  FRONTEND_URL,
  ADMIN_URL,
  'http://localhost:3000',
  'http://localhost:3001',
  'https://unimart-listing.vercel.app',        // NEW frontend
  'https://unimart-admin-ecru.vercel.app',     // OLD frontend
  'https://unimart-backend-f4ss.onrender.com', // Backend itself
  'https://unimart-backend-2.onrender.com',    // Alternative backend
];

console.log('🔒 CORS allowed origins:', allowedOrigins);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) {
      console.log('✅ CORS: No origin (curl/API call)');
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      console.log(`✅ CORS allowed: ${origin}`);
      callback(null, true);
    } else {
      console.log(`❌ CORS blocked: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-CSRF-Token',
    'x-csrf-token',           // Added lowercase version for compatibility
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
}));

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests' },
});
app.use('/api/', limiter);

// ── Database ──────────────────────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/unimart';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err.message));

const Listing = require('./models/Listing');

// ── Helpers ───────────────────────────────────────────────────────────────────
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input.trim().slice(0, 5000);
};

const validateEmail = (email) => /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/.test(email);

// ── Webhook ───────────────────────────────────────────────────────────────────
async function sendWebhookNotification(listingData, sellerData) {
  try {
    const payload = {
      seller_name:         sellerData.sellerName,
      seller_email:        sellerData.sellerEmail,
      seller_phone:        sellerData.sellerPhone || '',
      user_type:           sellerData.userType || 'student',
      location:            sellerData.location || '',
      product_title:       listingData.title,
      product_description: listingData.description,
      product_category:    listingData.category,
      product_brand:       listingData.brand || '',
      product_condition:   listingData.condition,
      product_price:       listingData.price,
      product_discount:    listingData.discount || null,
      delivery_type:       listingData.deliveryType || 'self',
      payment_method:      listingData.paymentMethod || 'mtn',
      tags:                listingData.tags || [],
      image_count:         listingData.imageUrls?.length || 0,
      submitted_at:        new Date().toISOString(),
      email_subject: `🎉 Your Uni-Mart listing "${listingData.title}" has been submitted!`,
      email_body: `Hi ${sellerData.sellerName} 👋,\n\nThank you for listing on Uni-Mart!\n\n📦 Product: ${listingData.title}\n💰 Price: GH₵${listingData.price}\n🏷️ Condition: ${listingData.condition}\n\nYour listing is pending review. You'll be notified once it goes live.\n\nHappy selling! 🚀`,
    };

    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(ZAPIER_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(tid);

    if (response.ok) {
      console.log('✅ [WEBHOOK] Sent successfully');
      return true;
    }
    console.error('❌ [WEBHOOK] Status:', response.status);
    return false;
  } catch (err) {
    console.error('❌ [WEBHOOK] Error:', err.message);
    return false;
  }
}

// ── ROUTES ────────────────────────────────────────────────────────────────────

app.get('/', (req, res) => res.json({ message: '🚀 UniMart Backend API', version: '1.0.0' }));
app.get('/api/health', (req, res) => res.json({ status: 'healthy', timestamp: new Date().toISOString() }));
app.get('/api/test',   (req, res) => res.json({ message: 'API is working!' }));

// ── Public listings ───────────────────────────────────────────────────────────
app.get('/api/public/listings', async (req, res) => {
  try {
    const listings = await Listing.find({ status: 'active' }).sort({ createdAt: -1 }).limit(20);
    res.json({ success: true, data: listings });
  } catch (err) {
    res.status(500).json({ error: 'Unable to fetch listings' });
  }
});

// ── GET ALL LISTINGS (with optional status filter) ────────────────────────────
app.get('/api/listings', async (req, res) => {
  try {
    const { status, limit = 100, page = 1 } = req.query;

    const query = {};
    if (status) query.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const [listings, total] = await Promise.all([
      Listing.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Listing.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: listings,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (err) {
    console.error('Error fetching listings:', err);
    res.status(500).json({ error: 'Unable to fetch listings' });
  }
});

// ── GET PENDING LISTINGS ──────────────────────────────────────────────────────
app.get('/api/listings/pending', async (req, res) => {
  try {
    const listings = await Listing.find({ status: 'pending' }).sort({ createdAt: -1 });
    res.json({ success: true, data: listings, count: listings.length });
  } catch (err) {
    res.status(500).json({ error: 'Unable to fetch pending listings' });
  }
});

// ── GET PENDING COUNT (used by sidebar badge) ─────────────────────────────────
app.get('/api/listings/pending/count', async (req, res) => {
  try {
    const count = await Listing.countDocuments({ status: 'pending' });
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ error: 'Unable to count pending listings', count: 0 });
  }
});

// ── GET SINGLE LISTING ────────────────────────────────────────────────────────
app.get('/api/listings/:id', async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    res.json({ success: true, data: listing });
  } catch (err) {
    res.status(500).json({ error: 'Unable to fetch listing' });
  }
});

// ── CREATE LISTING ────────────────────────────────────────────────────────────
app.post('/api/listings', async (req, res) => {
  try {
    const body = req.body;

    if (!body.sellerName)                        return res.status(400).json({ error: 'Seller name required' });
    if (!body.sellerEmail)                        return res.status(400).json({ error: 'Email required' });
    if (!validateEmail(body.sellerEmail))         return res.status(400).json({ error: 'Invalid email' });
    if (!body.title)                              return res.status(400).json({ error: 'Title required' });
    if (!body.description)                        return res.status(400).json({ error: 'Description required' });
    if (!body.price || Number(body.price) <= 0)  return res.status(400).json({ error: 'Valid price required' });
    if (!body.category)                           return res.status(400).json({ error: 'Category required' });

    const listingData = {
      sellerName:     sanitizeInput(body.sellerName),
      sellerEmail:    body.sellerEmail.toLowerCase().trim(),
      sellerPhone:    body.sellerPhone    ? sanitizeInput(body.sellerPhone)    : undefined,
      businessName:   body.businessName   ? sanitizeInput(body.businessName)   : undefined,
      location:       body.location       ? sanitizeInput(body.location)       : undefined,
      userType:       body.userType === 'vendor' ? 'vendor' : 'student',
      title:          sanitizeInput(body.title),
      description:    sanitizeInput(body.description),
      category:       body.category,
      brand:          body.brand          ? sanitizeInput(body.brand)          : undefined,
      condition:      body.condition      || 'Good',
      conditionNotes: body.conditionNotes ? sanitizeInput(body.conditionNotes) : undefined,
      price:          Number(body.price),
      discount:       body.discount ? Math.min(Math.max(Number(body.discount), 0), 100) : 0,
      edition:        body.edition        ? sanitizeInput(body.edition)        : undefined,
      deliveryType:   body.deliveryType === 'unimart' ? 'unimart' : 'self',
      paymentMethod:  body.paymentMethod  || 'mtn',
      paymentNumber:  body.paymentNumber  ? sanitizeInput(body.paymentNumber)  : undefined,
      tags:           Array.isArray(body.tags)      ? body.tags.slice(0, 12)  : [],
      imageUrls:      Array.isArray(body.imageUrls) ? body.imageUrls.slice(0, 5) : [],
      confidence:     body.confidence     || null,
      status:         'pending',
      isActive:       false,
      views:          0,
      sales:          0,
    };

    const listing = new Listing(listingData);
    await listing.save();

    console.log(`✅ Listing created: ${listing.title} (ID: ${listing._id})`);

    // Fire-and-forget webhook
    sendWebhookNotification(listingData, {
      sellerName:  listingData.sellerName,
      sellerEmail: listingData.sellerEmail,
      sellerPhone: listingData.sellerPhone,
      userType:    listingData.userType,
      location:    listingData.location,
    }).catch(err => console.error('Webhook error (non-blocking):', err));

    res.status(201).json({ success: true, data: listing, message: 'Listing created successfully' });

  } catch (err) {
    console.error('❌ Error creating listing:', err);
    res.status(500).json({ success: false, error: err.message || 'Unable to create listing' });
  }
});

// ── APPROVE LISTING ───────────────────────────────────────────────────────────
app.patch('/api/listings/:id/approve', async (req, res) => {
  try {
    const listing = await Listing.findByIdAndUpdate(
      req.params.id,
      { status: 'active', isActive: true, approvedAt: new Date() },
      { new: true }
    );
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    console.log(`✅ Listing approved: ${listing.title}`);
    res.json({ success: true, data: listing });
  } catch (err) {
    res.status(500).json({ error: 'Unable to approve listing' });
  }
});

// ── REJECT LISTING ────────────────────────────────────────────────────────────
app.patch('/api/listings/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    const listing = await Listing.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected', isActive: false, rejectedAt: new Date(), rejectionReason: reason || '' },
      { new: true }
    );
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    console.log(`🚫 Listing rejected: ${listing.title}`);
    res.json({ success: true, data: listing });
  } catch (err) {
    res.status(500).json({ error: 'Unable to reject listing' });
  }
});

// ── GENERIC STATUS UPDATE ─────────────────────────────────────────────────────
app.patch('/api/listings/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatus = ['pending', 'active', 'sold', 'archived', 'rejected'];
    if (!validStatus.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const listing = await Listing.findByIdAndUpdate(
      req.params.id,
      { status, isActive: status === 'active' },
      { new: true }
    );
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    res.json({ success: true, data: listing });
  } catch (err) {
    res.status(500).json({ error: 'Unable to update listing' });
  }
});

// ── DELETE LISTING ────────────────────────────────────────────────────────────
app.delete('/api/listings/:id', async (req, res) => {
  try {
    const listing = await Listing.findByIdAndDelete(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    res.json({ success: true, message: 'Listing deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Unable to delete listing' });
  }
});

// ── DASHBOARD KPI (enhanced) ──────────────────────────────────────────────────
app.get('/api/dashboard/kpi', async (req, res) => {
  try {
    const [total, pending, active, sold, rejected, topCategories, recentActivity] = await Promise.all([
      Listing.countDocuments(),
      Listing.countDocuments({ status: 'pending' }),
      Listing.countDocuments({ status: 'active' }),
      Listing.countDocuments({ status: 'sold' }),
      Listing.countDocuments({ status: 'rejected' }),

      // Top categories
      Listing.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),

      // Most recent 8 listings for activity feed
      Listing.find()
        .sort({ createdAt: -1 })
        .limit(8)
        .select('title sellerName sellerEmail status price category imageUrls createdAt'),
    ]);

    // Listings per day — last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentListings = await Listing.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        totalListings:   total,
        pendingListings: pending,
        activeListings:  active,
        soldListings:    sold,
        rejectedListings: rejected,
        topCategories,
        recentListings,
        recentActivity,
      },
    });
  } catch (err) {
    console.error('KPI error:', err);
    res.status(500).json({
      success: true,
      data: { totalListings: 0, pendingListings: 0, activeListings: 0, soldListings: 0, rejectedListings: 0, topCategories: [], recentListings: [], recentActivity: [] },
    });
  }
});

// ── NOTIFICATIONS (built from real listing events) ────────────────────────────
app.get('/api/notifications', async (req, res) => {
  try {
    const recent = await Listing.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .select('title sellerName sellerEmail status price category createdAt');

    const notifications = recent.map(listing => {
      const minutesAgo = Math.floor((Date.now() - new Date(listing.createdAt).getTime()) / 60000);
      const timeStr =
        minutesAgo < 1   ? 'Just now'       :
        minutesAgo < 60  ? `${minutesAgo}m ago` :
        minutesAgo < 1440 ? `${Math.floor(minutesAgo / 60)}h ago` :
                            `${Math.floor(minutesAgo / 1440)}d ago`;

      let type    = 'order';
      let message = '';

      if (listing.status === 'pending') {
        type    = 'order';
        message = `New listing submitted: "${listing.title}" by ${listing.sellerName} — GH₵${listing.price}`;
      } else if (listing.status === 'active') {
        type    = 'product';
        message = `Listing approved and live: "${listing.title}" in ${listing.category}`;
      } else if (listing.status === 'sold') {
        type    = 'order';
        message = `Sold! "${listing.title}" by ${listing.sellerName}`;
      } else if (listing.status === 'rejected') {
        type    = 'product';
        message = `Listing rejected: "${listing.title}" by ${listing.sellerName}`;
      }

      return {
        id:      listing._id.toString(),
        type,
        message,
        time:    timeStr,
        read:    listing.status !== 'pending',
        listing: {
          id:       listing._id.toString(),
          title:    listing.title,
          price:    listing.price,
          category: listing.category,
        },
      };
    });

    res.json({ success: true, data: notifications });
  } catch (err) {
    console.error('Notifications error:', err);
    res.status(500).json({ error: 'Unable to fetch notifications' });
  }
});

app.patch('/api/notifications/:id/read', async (req, res) => {
  res.json({ success: true });
});

// ── Error handlers ────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Resource not found' }));

app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(500).json({ error: err.message || 'An unexpected error occurred' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 UniMart API running on http://localhost:${PORT}`);
  console.log(`   🔒 CORS allowed origins: ${allowedOrigins.join(', ')}`);
  console.log(`   GET  /api/listings              — all listings`);
  console.log(`   GET  /api/listings?status=pending`);
  console.log(`   GET  /api/listings/pending       — pending only`);
  console.log(`   GET  /api/listings/pending/count — badge count`);
  console.log(`   PATCH /api/listings/:id/approve`);
  console.log(`   PATCH /api/listings/:id/reject`);
  console.log(`   GET  /api/dashboard/kpi`);
  console.log(`   GET  /api/notifications\n`);
});