// scripts/test-db.js
const mongoose = require('mongoose');
require('dotenv').config();

const testConnection = async () => {
  console.log('🔧 MongoDB Connection Test');
  console.log('==========================');
  
  const MONGODB_URI = process.env.MONGODB_URI;
  
  if (!MONGODB_URI) {
    console.error('❌ ERROR: MONGODB_URI not found in .env file');
    console.log('\n📝 Please create a .env file with:');
    console.log('MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/unimart');
    process.exit(1);
  }

  // Hide credentials in log
  const sanitizedUri = MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
  console.log(`📌 Connecting to: ${sanitizedUri}`);
  
  try {
    console.log('\n🔌 Attempting to connect to MongoDB...');
    
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    console.log('✅ SUCCESS: MongoDB connected!');
    console.log(`📊 Database: ${mongoose.connection.name}`);
    console.log(`🌍 Host: ${mongoose.connection.host}`);
    console.log(`🔢 Port: ${mongoose.connection.port}`);
    
    // List all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`\n📋 Collections (${collections.length}):`);
    collections.forEach(col => console.log(`   - ${col.name}`));
    
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
    console.log('✅ Test completed successfully');
    
  } catch (error) {
    console.error('\n❌ FAILED: Connection error');
    console.error(`   ${error.message}`);
    
    if (error.name === 'MongoServerError') {
      if (error.code === 18) {
        console.error('\n🔑 Authentication failed - check username/password');
      } else if (error.code === 13) {
        console.error('\n🚫 Unauthorized - check database permissions');
      }
    } else if (error.name === 'MongooseServerSelectionError') {
      console.error('\n🌐 Network error - check your connection string and IP whitelist');
      console.error('   Make sure your IP is whitelisted in MongoDB Atlas');
    }
    
    process.exit(1);
  }
};

testConnection();