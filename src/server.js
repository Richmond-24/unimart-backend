// ============================================
// API ROUTES - WITH INDIVIDUAL ERROR HANDLING
// ============================================

console.log('📦 Loading routes...');

// Helper to load routes individually - prevents one failure from breaking everything
const loadRoute = (path, routePath) => {
  try {
    app.use(path, require(routePath));
    console.log(`✅ ${path} loaded successfully`);
  } catch (error) {
    console.warn(`⚠️ ${path} skipped: ${error.message}`);
  }
};

// Load routes - each one independently
loadRoute('/api/auth', './routes/auth.routes.js');
loadRoute('/api/users', './routes/user.routes.js');
loadRoute('/api/products', './routes/product.routes.js');
loadRoute('/api/conversations', './routes/conversations.js');
loadRoute('/api/messages', './routes/messages.routes.js');
loadRoute('/api/categories', './routes/category.routes.js');

// Skip orders - missing model
// loadRoute('/api/orders', './routes/order.routes.js');

// Core functionality
loadRoute('/api/cart', './routes/cart.routes.js');
loadRoute('/api/food', './routes/food.routes.js');
loadRoute('/api/services', './routes/service.routes.js');
loadRoute('/api/events', './routes/event.routes.js');
loadRoute('/api/sellers', './routes/seller.routes.js');
loadRoute('/api/reviews', './routes/review.routes.js');
loadRoute('/api/notifications', './routes/nortification.js');

// OPTIONAL - Skip if credentials missing
// loadRoute('/api/riri', './routes/riri.routes.js');
// loadRoute('/api/chat/assistant', './routes/assistant.js');
// loadRoute('/api/ai-agent', './routes/aiAgent.routes.js');

// IMPORTANT - These MUST load
loadRoute('/api/home', './routes/home.routes.js');
loadRoute('/api/public', './routes/public.routes.js'); // ✅ This will load!
loadRoute('/api/listings', './routes/listings.js');
loadRoute('/api/upload', './routes/upload.routes.js');

// Search
loadRoute('/api/search', './routes/search-enhanced.js');
// loadRoute('/api', './routes/ai-search.routes.js'); // Skip - conflicts with /api/

// Other features
loadRoute('/api/product-notifications', './routes/productNotifications.js');
loadRoute('/api/webhooks', './routes/webhooks.routes.js');

console.log('✅ All routes processed');