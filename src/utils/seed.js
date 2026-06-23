require('dotenv').config();
const mongoose = require('mongoose');

const Category  = require('../models/Category.model');
const Product   = require('../models/Product.model');
const Food      = require('../models/Food.model');
const Service   = require('../models/Service.model');
const Event     = require('../models/Event.model');
const User      = require('../models/User.model');
const Seller    = require('../models/Seller.model');
const FlashDeal = require('../models/FlashDeal.model');

const CATEGORIES = [
  { name:'Fruits & Veg',   slug:'fruits',       bgColor:'#FFE8E8', hint:'Fresh & Organic',     order:1 },
  { name:'Dairy & Bakery', slug:'dairy',         bgColor:'#E8F0FE', hint:'Fresh Milk, Bread',   order:2 },
  { name:'Snacks',         slug:'snacks',        bgColor:'#FFF3E0', hint:'Chips, Cookies',       order:3 },
  { name:'Beverages',      slug:'beverages',     bgColor:'#E0F7FA', hint:'Soft Drinks, Juices', order:4 },
  { name:'Personal Care',  slug:'personal',      bgColor:'#F3E8FF', hint:'Hygiene Products',    order:5 },
  { name:'Household',      slug:'household',     bgColor:'#E8F5E9', hint:'Cleaning Essentials', order:6 },
  { name:'Stationery',     slug:'stationery',    bgColor:'#FFF9C4', hint:'Books, Pens',          order:7 },
  { name:'Electronics',    slug:'electronics',   bgColor:'#E1F5FE', hint:'Gadgets',              order:8 },
  { name:'Clothing',       slug:'clothes',       bgColor:'#FCE4EC', hint:'Fashion',              order:9 },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('🔗 Connected to MongoDB');

  // Clear
  await Promise.all([
    Category.deleteMany(), Product.deleteMany(), Food.deleteMany(),
    Service.deleteMany(), Event.deleteMany(), Seller.deleteMany(),
    FlashDeal.deleteMany(),
  ]);
  console.log('🧹 Cleared existing data');

  // Categories
  const cats = await Category.insertMany(CATEGORIES);
  console.log(`✅ ${cats.length} categories seeded`);

  // Demo seller user
  let seller = await User.findOne({ email: 'seller@unimart.gh' });
  if (!seller) {
    seller = await User.create({
      name: "Ama's Kitchen", email: 'seller@unimart.gh',
      password: 'password123', role: 'seller',
      university: 'University of Ghana', hall: 'Legon Hall',
    });
  }
  await Seller.findOneAndUpdate(
    { user: seller._id },
    { user: seller._id, shopName: "Ama's Kitchen", rating: 4.9,
      numReviews: 128, badge: 'Top Seller', isVerified: true,
      university: 'University of Ghana' },
    { upsert: true }
  );

  // Products
  const elec = cats.find(c => c.slug === 'electronics');
  const cloth = cats.find(c => c.slug === 'clothes');
  await Product.insertMany([
    { title:'Wireless Earbuds', price:89, oldPrice:150, discount:41, images:['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400'],
      category:elec._id, seller:seller._id, isTrending:true, sold:2300, rating:4.8, stock:20,
      tags:['earbuds','wireless','audio'] },
    { title:'Smart Watch',      price:250,oldPrice:400, discount:38, images:['https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=400'],
      category:elec._id, seller:seller._id, isTrending:true, sold:956,  rating:4.9, stock:8,
      tags:['smartwatch','wearable','tech'] },
    { title:'Used HP Laptop i5',price:850,oldPrice:2500,discount:66, images:['https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400'],
      category:elec._id, seller:seller._id, isUsed:true, condition:'Good', sold:5, rating:4.6, stock:1,
      tags:['laptop','hp','used','computer'] },
    { title:'Graphic Hoodie',   price:120,oldPrice:200, discount:40, images:['https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=400'],
      category:cloth._id,seller:seller._id, isTrending:true, sold:1800, rating:4.7, stock:15,
      tags:['hoodie','fashion','clothing'] },
  ]);
  console.log('✅ Products seeded');

  // Food
  await Food.insertMany([
    { title:'Jollof Rice + Chicken',    chef:'Chef Ama',    seller:seller._id, price:25, deliveryFee:3,
      rating:4.9, deliveryTime:'20-30 min', badge:'Popular',     ordersToday:230,
      image:'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=400' },
    { title:'Waakye + Egg & Spaghetti', chef:'Mama Abena',  seller:seller._id, price:18, deliveryFee:3,
      rating:4.8, deliveryTime:'15-25 min', badge:'Best Seller',  ordersToday:450,
      image:'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400' },
    { title:'Student Meal Deal',         chef:'Campus Eats', seller:seller._id, price:15, deliveryFee:2,
      rating:4.7, deliveryTime:'10-20 min', badge:'Value',         ordersToday:180,
      image:'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=400' },
  ]);
  console.log('✅ Food seeded');

  // Services
  await Service.insertMany([
    { title:'Hair Braiding',        provider:"Ama's Styles",   seller:seller._id, price:45, oldPrice:80,  discount:44,
      rating:4.9, badge:'Top Rated',      location:'Legon Hall',    availability:'Today',    category:'beauty' },
    { title:'Mathematics Tutoring', provider:'Kwame Tutoring', seller:seller._id, price:25, oldPrice:50,  discount:50,
      rating:5.0, badge:'Verified',       location:'UG Campus',     availability:'Flexible', category:'tutoring' },
    { title:'Photography',          provider:'Lens Masters',   seller:seller._id, price:80, oldPrice:150, discount:47,
      rating:4.7, badge:'Popular',        location:'All campuses',  availability:'Book now', category:'photography' },
  ]);
  console.log('✅ Services seeded');

  // Events
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const friday   = new Date(); friday.setDate(friday.getDate() + 4);
  await Event.insertMany([
    { title:'Freshers Night',    organizer:seller._id, location:'Legon Hall',    date:new Date(),  dateLabel:'Today, 8pm',   price:20, isFree:false, attending:234, badge:'Happening Tonight', university:'University of Ghana' },
    { title:'Inter-Hall Sports', organizer:seller._id, location:'Sports Stadium',date:tomorrow,    dateLabel:'Tomorrow, 2pm',price:0,  isFree:true,  attending:567, badge:'Free Entry',        university:'University of Ghana' },
    { title:'Career Fair 2026',  organizer:seller._id, location:'CCE Building',  date:friday,      dateLabel:'Fri, 10am',    price:0,  isFree:true,  attending:892, badge:'15+ Companies',     university:'University of Ghana' },
  ]);
  console.log('✅ Events seeded');

  // Flash deals (expire in 6 hours) — create dummy deals for development
  const expire = new Date(Date.now() + 6 * 60 * 60 * 1000);
  await FlashDeal.create([
    {
      title: 'Power Bank 20K mAh',
      image: 'https://images.unsplash.com/photo-1609592424749-2ea836c6f0b4?w=400',
      price: 99,
      oldPrice: 180,
      discount: 45,
      expiresAt: expire,
      stock: 10,
    },
    {
      title: 'Campus Backpack',
      image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400',
      price: 79,
      oldPrice: 129,
      discount: 39,
      expiresAt: expire,
      stock: 15,
    }
  ]);
  console.log('✅ Flash deals seeded (dummy data)');

  console.log('\n🎉 Seed complete!');
  console.log('📧 Seller login: seller@unimart.gh / password123');
  await mongoose.disconnect();
}

seed().catch(err => { console.error('❌ Seed error:', err); process.exit(1); });
