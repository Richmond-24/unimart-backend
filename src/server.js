
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const uploadRoutes = require('./routes/upload.routes.js');
const aiSearchRoutes = require('./routes/ai-search.routes.js');
const jwt = require('jsonwebtoken');
const http = require('http');
const { Server } = require('socket.io');

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration - prefer a configured frontend origin list via FRONTEND_URL (comma-separated)
const frontendEnv = process.env.FRONTEND_URL || '';
const allowedOrigins = frontendEnv ? frontendEnv.split(',').map(s => s.trim()) : ['*'];
app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (mobile apps, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes('*') || allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    return callback(new Error('CORS policy: Origin not allowed'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Global rate limiting (fallback)
app.use(rateLimit({ 
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200 // limit each IP to 200 requests per windowMs
}));

// Stricter rate limiting for auth endpoints (protect register/login from brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10', 10), // default 10 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging in development
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Serve static files from uploads directory
app.use('/uploads', express.static('uploads'));

// ==================== ROUTES ====================
app.use('/api/auth', authLimiter, require('./routes/auth.routes.js'));
app.use('/api/users', require('./routes/user.routes.js'));
app.use('/api/products', require('./routes/product.routes.js'));
app.use('/api/conversations', require('./routes/conversations.js'));
app.use('/api/categories', require('./routes/category.routes.js'));
app.use('/api/orders', require('./routes/order.routes.js'));
app.use('/api/cart', require('./routes/cart.routes.js'));
app.use('/api/food', require('./routes/food.routes.js'));
app.use('/api/services', require('./routes/service.routes.js'));
app.use('/api/events', require('./routes/event.routes.js'));
app.use('/api/sellers', require('./routes/seller.routes.js'));
app.use('/api/reviews', require('./routes/review.routes.js'));
app.use('/api/notifications', require('./routes/nortification.js').router);
app.use('/api/riri', require('./routes/riri.routes.js'));
app.use('/api/home', require('./routes/home.routes.js'));
app.use('/api/public', require('./routes/public.routes.js'));
app.use('/api/listings', require('./routes/listings.js'));
app.use('/api/upload', require('./routes/upload.routes.js'));
app.use('/api/chat/assistant', require('./routes/assistant.js'));
app.use('/api/ai-agent', require('./routes/aiAgent.routes.js'));
app.use('/api/search', require('./routes/search-enhanced.js')); // Enhanced search with filters
app.use('/api', aiSearchRoutes);   // now POST /api/ai-search works
// Product notifications (flash deals, trending, etc.)
app.use('/api/product-notifications', require('./routes/productNotifications.js'));
// External webhooks (e.g. external listing site)
app.use('/api/webhooks', require('./routes/webhooks.routes.js'));

app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    app: 'UniMart API v1.0', 
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Root route - helpful for testing
app.get('/', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Welcome to UniMart API',
    docs: '/api/health',
    version: '1.0.0'
  });
});

// ==================== 404 HANDLER ====================
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: `Route ${req.originalUrl} not found`,
    method: req.method
  });
});

// ==================== ERROR HANDLER ====================
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  const status = err.statusCode || 500;
  const message = (process.env.NODE_ENV === 'development') ? (err.message || 'Internal Server Error') : 'Internal Server Error';
  const response = { success: false, message };
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
    if (err.details) response.details = err.details;
  }
  res.status(status).json(response);
});

// ==================== DATABASE CONNECTION & SERVER START ====================
const startServer = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/unimart');
    console.log('✅  MongoDB connected successfully');

    // Get network interfaces
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();
    let networkAddress = 'Not available';
    
    // Find the IPv4 address that's not localhost
    Object.keys(networkInterfaces).forEach((interfaceName) => {
      networkInterfaces[interfaceName].forEach((interface) => {
        if (interface.family === 'IPv4' && !interface.internal) {
          networkAddress = interface.address;
        }
      });
    });

    // Create HTTP server and Socket.io for realtime chat
    const server = http.createServer(app);
    const io = new Server(server, {
      cors: { origin: '*', methods: ['GET', 'POST'] }
    });

    const onlineUsers = new Map();

    io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error('Authentication required'));
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // support both { id } and { userId }
        socket.userId = decoded.userId || decoded.id || decoded._id;
        next();
      } catch (error) {
        next(new Error('Invalid token'));
      }
    });

    io.on('connection', (socket) => {
      const userId = String(socket.userId);
      onlineUsers.set(userId, socket.id);
      // join a personal room for the user to receive targeted events
      socket.join(`user:${userId}`);
      socket.broadcast.emit('user_online', { userId });

      socket.on('join_conversation', async (conversationId) => {
        try {
          const Conversation = require('./models/Conversation.js');
          const conversation = await Conversation.findOne({ _id: conversationId, participants: socket.userId });
          if (!conversation) return socket.emit('error', { message: 'Not authorized' });
          socket.join(`conversation:${conversationId}`);
        } catch (err) {
          socket.emit('error', { message: 'Server error joining conversation' });
        }
      });

      socket.on('send_message', async (data) => {
        try {
          const { conversationId, text, type = 'text', imageUrl } = data;
          const Conversation = require('./models/Conversation.js');
          const Message = require('./models/Message.js');
          const conversation = await Conversation.findOne({ _id: conversationId, participants: socket.userId });
          if (!conversation) return socket.emit('error', { message: 'Conversation not found' });

          const message = await Message.create({
            conversation: conversationId,
            sender: socket.userId,
            text, type, imageUrl,
            timestamp: new Date()
          });
          await message.populate('sender', 'name photoURL');

          const receiverId = conversation.participants.find(p => p.toString() !== userId);

          await Conversation.findByIdAndUpdate(conversationId, {
            lastMessage: { text, senderId: socket.userId, timestamp: new Date() },
            updatedAt: new Date(),
            $inc: { [`unreadCount.${receiverId}`]: 1 }
          });

          io.to(`conversation:${conversationId}`).emit('new_message', { message, conversationId });
          socket.emit('message_sent', { message, conversationId });
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      socket.on('typing', (conversationId) => {
        socket.to(`conversation:${conversationId}`).emit('user_typing', { userId, conversationId });
      });

      socket.on('stop_typing', (conversationId) => {
        socket.to(`conversation:${conversationId}`).emit('user_stop_typing', { userId, conversationId });
      });

      socket.on('disconnect', () => {
        onlineUsers.delete(userId);
        socket.broadcast.emit('user_offline', { userId });
      });
    });

    app.set('io', io);

    // Function to try starting server on a port
    const tryPort = (port) => {
      return new Promise((resolve, reject) => {
        server.listen(port, '0.0.0.0')
          .once('listening', () => {
            console.log('\n🚀  ==================================');
            console.log('🚀     UniMart API IS RUNNING');
            console.log('🚀  ==================================');
            console.log(`📡  Port:        ${port}`);
            console.log(`💻  Local URL:   http://localhost:${port}`);
            console.log(`📱  Network URL: http://${networkAddress}:${port}`);
            console.log(`🔍  Health Check: http://${networkAddress}:${port}/api/health`);
            console.log('\n📱  FOR YOUR HUAWEI PHONE:');
            console.log(`   👉  http://${networkAddress}:${port}/api/health`);
            console.log('\n🚀  ==================================\n');
            resolve(server);
          })
          .once('error', (err) => {
            if (err.code === 'EADDRINUSE') {
              console.log(`⚠️  Port ${port} is busy, trying ${port + 1}...`);
              reject(err);
            } else {
              console.error('❌ Server error:', err);
              reject(err);
            }
          });
      });
    };

    // Try ports starting from the configured PORT
    const startPort = parseInt(process.env.PORT) || 5000;
    let currentPort = startPort;
    let maxAttempts = 10; // Try up to 10 ports
    let serverStarted = false;

    while (!serverStarted && maxAttempts > 0) {
      try {
        await tryPort(currentPort);
        serverStarted = true;
      } catch (err) {
        if (err.code === 'EADDRINUSE') {
          currentPort++;
          maxAttempts--;
          if (maxAttempts === 0) {
            console.error('❌ Could not find an available port after multiple attempts');
            process.exit(1);
          }
        } else {
          throw err;
        }
      }
    }

  } catch (error) {
    console.error('❌  Failed to start server:', error.message);
    console.error('   Make sure MongoDB is running and MONGO_URI is correct');
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌  Unhandled Promise Rejection:', err.message);
  // Close server & exit process
  process.exit(1);
});

// Start the server
startServer();

module.exports = app;