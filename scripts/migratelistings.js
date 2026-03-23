// /backend/scripts/migrateListings.js

const mongoose = require('mongoose');
const Listing = require('../models/Listing');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/unimart')
  .then(async () => {
    console.log('Connected to MongoDB, migrating listings...');
    
    // Update all listings to have proper status
    await Listing.updateMany(
      { status: { $exists: false } },
      { $set: { status: 'pending', isActive: false } }
    );
    
    // For listings that were already active, set them to active
    await Listing.updateMany(
      { status: 'active' },
      { $set: { isActive: true } }
    );
    
    console.log('Migration complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });