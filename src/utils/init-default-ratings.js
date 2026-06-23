require('dotenv').config();
const mongoose = require('mongoose');

const Listing = require('../models/Listing');
const Seller = require('../models/Seller.model');
const Product = require('../models/Product.model');

async function init() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('🔗 Connected to MongoDB');

  // Set default rating 2 for Listings without rating
  const lRes = await Listing.updateMany(
    { $or: [ { rating: { $exists: false } }, { rating: 0 } ] },
    { $set: { rating: 2, reviewCount: 0 } }
  );
  console.log(`✅ Listings updated: ${lRes.modifiedCount || lRes.nModified || 0}`);

  // Set default rating 2 for Sellers without rating
  const sRes = await Seller.updateMany(
    { $or: [ { rating: { $exists: false } }, { rating: 0 } ] },
    { $set: { rating: 2, numReviews: 0 } }
  );
  console.log(`✅ Sellers updated: ${sRes.modifiedCount || sRes.nModified || 0}`);

  // Set default rating 2 for Products without rating
  try {
    const pRes = await Product.updateMany(
      { $or: [ { rating: { $exists: false } }, { rating: 0 } ] },
      { $set: { rating: 2, numReviews: 0 } }
    );
    console.log(`✅ Products updated: ${pRes.modifiedCount || pRes.nModified || 0}`);
  } catch (e) {
    console.warn('⚠️ Product update skipped (Product model may not store rating):', e.message);
  }

  await mongoose.disconnect();
  console.log('🎉 Done');
}

init().catch(err => { console.error('❌ Error:', err); process.exit(1); });
