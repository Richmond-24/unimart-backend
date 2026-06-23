const Listing = require('../models/Listing');

// Accepts listing data from an external listing site and creates a Listing.
// Protect with a shared secret (header `x-external-secret` or `secret` in body/query).
exports.externalListingCreate = async (req, res, next) => {
  try {
    const provided = req.get('x-external-secret') || req.query.secret || req.body.secret;
    const secret = process.env.EXTERNAL_LISTING_SECRET || '';
    if (!secret || provided !== secret) {
      return res.status(401).json({ success: false, message: 'Invalid webhook secret' });
    }
    const { sellerId, title, description, price, images, isActive = true, sellerEmail, sellerName, ...rest } = req.body;
    if (!sellerId && !sellerEmail) return res.status(400).json({ success: false, message: 'sellerId or sellerEmail is required' });

    const payload = {
      title: title || rest.name || 'Untitled Listing',
      description: description || rest.description || '',
      price: price || rest.price || 0,
      imageUrls: images || (rest.images || []),
      sellerEmail: sellerEmail || rest.sellerEmail || '',
      sellerName: sellerName || rest.sellerName || '',
      isActive,
      status: isActive ? 'active' : 'pending',
      ...rest
    };

    const listing = await Listing.create(payload);

    // If sellerId not provided but sellerEmail present, try to resolve user id for emitting
    let resolvedUserId = sellerId || null;
    if (!resolvedUserId && payload.sellerEmail) {
      try {
        const User = require('../models/User.model');
        const user = await User.findOne({ email: payload.sellerEmail.toLowerCase() }).select('_id');
        if (user) resolvedUserId = String(user._id);
      } catch (e) {
        // ignore resolution errors
      }
    }

    // Emit realtime event to the seller's room so dashboards update
    try {
      const io = req.app && req.app.get && req.app.get('io');
      if (io) {
        if (resolvedUserId) {
          const room = `user:${String(resolvedUserId)}`;
          io.to(room).emit('seller:product_created', listing);
        } else if (payload.sellerEmail) {
          // As a fallback, broadcast a general event that frontends can filter
          io.emit('seller:product_created:by_email', { email: payload.sellerEmail, listing });
        }
      }
    } catch (emitErr) {
      console.error('Webhook emit failed', emitErr);
    }

    return res.json({ success: true, data: listing });
  } catch (err) {
    next(err);
  }
};
