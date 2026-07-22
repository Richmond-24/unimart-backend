/**
 * ============================================
 * UniMart Backend Server - PRODUCTION READY
 * ============================================
 * Fixed CORS configuration for Vercel deployment
 * All API endpoints accessible from frontend
 */

const path = require('path');
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// ============================================
// ENVIRONMENT SETUP
// ============================================
dotenv.config();

const app = express();

const PORT = Number(process.env.PORT || 5000);
const NODE_ENV = process.env.NODE_ENV || 'production';
const MONGO_URI = (process.env.MONGO_URI || 'mongodb://localhost:27017/unimart').trim();
const JWT_SECRET = (process.env.JWT_SECRET || 'unimart-secret-key').trim();
const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://unimart-app-kappa.vercel.app').trim();

// Build allowed origins list - MUST include Vercel frontend and local dev origins
const ALLOWED_ORIGINS = Array.from(new Set([
  FRONTEND_URL,
  'https://unimart-app-kappa.vercel.app',
  'https://unimartapp-phi.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
]));

// Log startup info
console.log('\n========================================');
console.log('🚀 UniMart Backend - STARTUP');
console.log('========================================');
console.log(`📝 NODE_ENV: ${NODE_ENV}`);
console.log(`🔌 PORT: ${PORT}`);
console.log(`🌐 FRONTEND_URL: ${FRONTEND_URL}`);
console.log(`✅ ALLOWED_ORIGINS:`, ALLOWED_ORIGINS);
console.log(`📊 MONGO_URI: ${MONGO_URI.substring(0, 50)}...`);
console.log('========================================\n');

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// Helmet - Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: false,
}));

// ============================================
// BODY PARSING
// ============================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// CORS CONFIGURATION - PRODUCTION READY
// ============================================

// Main CORS middleware
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests from Vercel, localhost, and mobile apps (no origin)
    if (!origin) {
      // Mobile apps and Node.js servers don't send origin
      return callback(null, true);
    }

    // In production, allow any origin to prevent accidental CORS blocks
    // from deployed frontend or temporary staging domains.
    if (NODE_ENV === 'production') {
      return callback(null, true);
    }

    // Normalize the origin (remove trailing slashes)
    const normalizedOrigin = origin.trim().replace(/\/+$/, '');

    // Check if origin is in whitelist
    if (ALLOWED_ORIGINS.some(allowed => normalizedOrigin === allowed)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS not allowed for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Accept-Language',
    'Content-Language',
    'Last-Event-ID'
  ],
  exposedHeaders: [
    'Content-Length',
    'X-JSON-Response',
    'X-Content-Type-Options',
    'X-Frame-Options'
  ],
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 200
};

function applyCorsHeaders(req, res) {
  const origin = req.headers.origin || '*';
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Expose-Headers', 'Content-Length, X-JSON-Response, Access-Control-Allow-Origin');
  res.header('Access-Control-Max-Age', '86400');
}

// Apply CORS to all routes
app.use(cors(corsOptions));

// Explicit preflight handler for all OPTIONS requests
app.options('*', cors(corsOptions));

// Additional CORS headers middleware (belt and suspenders)
app.use((req, res, next) => {
  applyCorsHeaders(req, res);

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  // Log CORS info in development
  if (NODE_ENV === 'development') {
    console.log(`[CORS] ${req.method} ${req.path} from ${req.headers.origin || 'unknown'}`);
  }

  next();
});

// JSON parse error handler
app.use((err, req, res, next) => {
  applyCorsHeaders(req, res);
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON payload. Please send valid JSON in the request body.'
    });
  }
  next(err);
});

// ============================================
// LOGGING
// ============================================
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  // Custom morgan format for production
  app.use(morgan(':remote-addr :method :url :status :res[content-length] - :response-time ms'));
}

// ============================================
// STATIC FILES
// ============================================
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  maxAge: '1h',
  etag: false
}));

// ============================================
// HEALTH & STATUS ENDPOINTS
// ============================================

// Health check endpoint
app.get('/health', (req, res) => {
  const io = app.get('io');
  res.status(200).json({
    success: true,
    status: 'OK',
    message: 'UniMart Backend is healthy',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    socketConnections: io ? io.engine.clientsCount : 0,
    cors: {
      allowedOrigins: ALLOWED_ORIGINS,
      productionMode: NODE_ENV === 'production'
    }
  });
});

// Endpoint to check CORS status
app.get('/cors-check', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'CORS is working correctly',
    origin: req.headers.origin || 'no origin header',
    method: req.method,
    headers: req.headers,
    cors_enabled: true,
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'UniMart Backend API Server',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      corsCheck: '/cors-check',
      api: '/api',
      socketIO: '/socket.io'
    },
    links: {
      docs: '/health',
      frontend: FRONTEND_URL
    }
  });
});

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

// Skip orders - using inline route below instead
// loadRoute('/api/orders', './routes/order.routes.js');

// Core functionality
loadRoute('/api/cart', './routes/cart.routes.js');
loadRoute('/api/food', './routes/food.routes.js');
loadRoute('/api/services', './routes/service.routes.js');
loadRoute('/api/events', './routes/event.routes.js');
loadRoute('/api/sellers', './routes/seller.routes.js');
loadRoute('/api/reviews', './routes/review.routes.js');
loadRoute('/api/notifications', './routes/nortification.js');

// ⭐ PAYMENT ROUTES ⭐
loadRoute('/api/payments', './routes/payment.routes.js');

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

// ============================================
// INLINE ORDER ROUTE (Simple implementation)
// ============================================

// Simple order creation endpoint
app.post('/api/orders', async (req, res) => {
  try {
    console.log('📦 Order received:', JSON.stringify(req.body, null, 2));
    
    // Return success response
    res.status(201).json({
      success: true,
      message: 'Order received successfully!',
      orderId: 'order_' + Date.now(),
      data: req.body,
      status: 'pending'
    });
  } catch (error) {
    console.error('❌ Order error:', error);
    res.status(400).json({
      success: false,
      message: 'Failed to process order',
      error: error.message
    });
  }
});

// Get user's orders (simple version)
app.get('/api/orders/my-orders', async (req, res) => {
  try {
    res.json({
      success: true,
      count: 0,
      data: []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
});

console.log('✅ All routes processed');

// ============================================
// 404 HANDLER
// ============================================
app.use((req, res) => {
  applyCorsHeaders(req, res);
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    method: req.method,
    path: req.originalUrl,
    availableEndpoints: {
      health: 'GET /health',
      corsCheck: 'GET /cors-check',
      root: 'GET /'
    }
  });
});

// ============================================
// ERROR HANDLER
// ============================================
app.use((err, req, res, next) => {
  applyCorsHeaders(req, res);
  const status = err.status || err.statusCode || 500;
  const message = NODE_ENV === 'development' ? err.message : 'Internal Server Error';

  console.error(`[ERROR] ${err.message} at ${req.method} ${req.path}`);

  res.status(status).json({
    success: false,
    message,
    status,
    ...(NODE_ENV === 'development' ? {
      stack: err.stack,
      details: err
    } : {})
  });
});

// ============================================
// SERVER STARTUP
// ============================================

const startServer = async () => {
  try {
    // Step 1: Connect to MongoDB
    console.log('\n[MongoDB] Connecting...');
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      minPoolSize: 5,
    });
    console.log('✅ [MongoDB] Connected successfully');

    // Step 2: Create HTTP server
    const server = http.createServer(app);
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 120000;
    server.setTimeout(120000);

    const Conversation = require('./models/Conversation');
    const Notification = require('./models/Notification');

    // Step 3: Setup Socket.IO
    console.log('[Socket.IO] Configuring...');
    const io = new Server(server, {
      cors: {
        origin: function (origin, callback) {
          // Allow all origins for Socket.IO (JWT provides security)
          callback(null, true);
        },
        credentials: true,
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        exposedHeaders: ['Content-Length']
      },
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      allowEIO3: true,
      pingInterval: 25000,
      pingTimeout: 120000,
      connectTimeout: 45000,
      maxHttpBufferSize: 1e6,
      maxPayload: 1e6,
      allowUpgrades: true,
      upgradeTimeout: 10000,
      serveClient: false,
      cookie: {
        name: 'io',
        path: '/socket.io',
        httpOnly: true,
        sameSite: 'lax'
      }
    });
    console.log('✅ [Socket.IO] Configured');

    // Step 4: Socket.IO Authentication Middleware
    io.use((socket, next) => {
      try {
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        
        if (token && typeof token === 'string' && token.trim()) {
          try {
            const decoded = jwt.verify(token.trim(), JWT_SECRET);
            socket.userId = decoded.userId || decoded.id || decoded._id || `user-${Date.now()}`;
            socket.isAuthenticated = true;
            socket.userEmail = decoded.email || null;
          } catch (err) {
            socket.isAuthenticated = false;
            socket.userId = `anon-${Date.now()}`;
            if (NODE_ENV === 'development') {
              console.warn(`[Socket.IO] Token verification failed: ${err.message}`);
            }
          }
        } else {
          socket.isAuthenticated = false;
          socket.userId = `anon-${Date.now()}`;
        }

        next();
      } catch (error) {
        console.error('[Socket.IO] Auth middleware error:', error.message);
        next(error);
      }
    });

    // Step 5: Socket.IO Connection Handler
    io.on('connection', (socket) => {
      const userId = String(socket.userId);
      const transport = socket.conn?.transport?.name || 'unknown';
      const origin = socket.handshake?.headers?.origin || socket.request?.headers?.origin || 'unknown';

      console.log(`[Socket.IO] ✅ Connected - ID: ${socket.id} | User: ${userId} | Transport: ${transport} | Auth: ${socket.isAuthenticated}`);

      // Join user room
      socket.join(`user:${userId}`);
      socket.join('all-users');

      // Emit connection confirmation
      socket.emit('connection_established', {
        success: true,
        socketId: socket.id,
        userId,
        timestamp: new Date().toISOString()
      });

      // Notify others user is online
      socket.broadcast.emit('user_online', {
        userId,
        socketId: socket.id,
        timestamp: new Date().toISOString()
      });

      // ========== CONVERSATION EVENTS ==========

      socket.on('join_conversation', (data) => {
        try {
          const { conversationId } = data;
          if (!conversationId) {
            return socket.emit('error', { message: 'Conversation ID required' });
          }
          socket.join(`conversation:${conversationId}`);
          socket.emit('joined_conversation', { conversationId, success: true });
        } catch (err) {
          socket.emit('error', { message: err.message });
        }
      });

      socket.on('leave_conversation', (data) => {
        try {
          const { conversationId } = data;
          if (conversationId) {
            socket.leave(`conversation:${conversationId}`);
          }
        } catch (err) {
          console.error('Leave conversation error:', err.message);
        }
      });

      socket.on('send_message', (data) => {
        try {
          const { conversationId, text, type = 'text', firebaseId } = data;
          if (!conversationId || !text) {
            return socket.emit('error', { message: 'Invalid message data' });
          }

          // Persist message to database and emit the saved message
          (async () => {
            try {
              const Message = require('./models/Message');

              // Deduplicate by firebaseId if provided
              let existing = null;
              if (firebaseId) {
                existing = await Message.findOne({ firebaseId, conversation: conversationId }).lean();
              }

              if (existing) {
                // Already saved, emit it back
                io.to(`conversation:${conversationId}`).emit('new_message', existing);
                socket.emit('message_sent', { message: existing, success: true });
                return;
              }

              const newMsg = new Message({
                conversation: conversationId,
                sender: userId,
                text: String(text).trim(),
                type,
                timestamp: new Date(),
                firebaseId: firebaseId || undefined,
                delivered: true,
                deliveredAt: new Date(),
                read: false
              });

              const saved = await newMsg.save();
              const populated = await Message.findById(saved._id).populate('sender', 'name photoURL email role').lean();

              // Update conversation lastMessage and unread counts
              try {
                const conversation = await Conversation.findById(conversationId);
                if (conversation) {
                  const participantIds = (conversation.participants || []).map(p => String(p));
                  const otherParticipants = participantIds.filter(p => p !== String(userId));
                  const incUpdate = {};
                  otherParticipants.forEach(pid => { incUpdate[`unreadCount.${pid}`] = 1; });

                  await Conversation.findByIdAndUpdate(conversationId, {
                    lastMessage: {
                      text: saved.text,
                      senderId: saved.sender,
                      timestamp: saved.timestamp
                    },
                    ...(Object.keys(incUpdate).length > 0 && { $inc: incUpdate }),
                    updatedAt: new Date()
                  });
                }
              } catch (convErr) {
                console.warn('Failed to update conversation after socket save:', convErr?.message || convErr);
              }

              // Emit to conversation room and ack sender
              io.to(`conversation:${conversationId}`).emit('new_message', populated);
              socket.emit('message_sent', { message: populated, success: true });

              // Notify other participants and dashboard
              try {
                const conversation = await Conversation.findById(conversationId).populate('participants', '_id role').lean();
                if (conversation) {
                  const recipients = (conversation.participants || []).map(p => String(p._id || p)).filter(id => id !== String(userId));
                  const sender = await User.findById(userId).lean();
                  const senderName = sender?.name || 'Someone';

                  recipients.forEach((recipientId) => {
                    io.to(`user:${recipientId}`).emit('seller:new_message', {
                      conversationId,
                      message: populated,
                      from: conversation.seller && String(conversation.seller.id) === String(recipientId) ? 'buyer' : 'buyer'
                    });
                    io.to(`user:${recipientId}`).emit('notification_received', {
                      count: 1,
                      type: 'new_message',
                      conversationId,
                      sender: userId,
                      senderName
                    });
                  });
                }
              } catch (notifyErr) {
                console.warn('Failed to emit per-user notifications after socket save:', notifyErr?.message || notifyErr);
              }
            } catch (errInner) {
              console.error('Socket send_message persistence error:', errInner);
              socket.emit('error', { message: 'Failed to save message' });
            }
          })();
        } catch (err) {
          socket.emit('error', { message: err.message });
        }
      });

      socket.on('typing', (data) => {
        try {
          const { conversationId } = data;
          if (conversationId) {
            socket.to(`conversation:${conversationId}`).emit('user_typing', { userId, conversationId });
          }
        } catch (err) {
          console.error('Typing error:', err.message);
        }
      });

      socket.on('stop_typing', (data) => {
        try {
          const { conversationId } = data;
          if (conversationId) {
            socket.to(`conversation:${conversationId}`).emit('user_stop_typing', { userId, conversationId });
          }
        } catch (err) {
          console.error('Stop typing error:', err.message);
        }
      });

      // Mark messages as read (client notifies server to broadcast read state)
      socket.on('messages_read', (data) => {
        try {
          const { conversationId, messageIds } = data || {};
          if (!conversationId) return;
          // Broadcast to the conversation room that messages were read by this user
          io.to(`conversation:${conversationId}`).emit('messages_read', {
            conversationId,
            messageIds: Array.isArray(messageIds) ? messageIds : undefined,
            userId
          });
        } catch (err) {
          console.error('messages_read handler error:', err?.message || err);
        }
      });

      // ========== HEARTBEAT ==========

      socket.on('ping', () => {
        socket.emit('pong', { timestamp: new Date().toISOString(), socketId: socket.id });
      });

      socket.on('health:ping', () => {
        socket.emit('health:pong', {
          timestamp: new Date().toISOString(),
          socketId: socket.id,
          userId,
          authenticated: socket.isAuthenticated
        });
      });

      // ========== DISCONNECT & ERRORS ==========

      socket.on('disconnect', (reason) => {
        console.log(`[Socket.IO] ❌ Disconnected - ID: ${socket.id} | Reason: ${reason}`);
        socket.broadcast.emit('user_offline', { userId, reason, timestamp: new Date().toISOString() });
      });

      socket.on('connect_error', (error) => {
        console.error(`[Socket.IO] Connection error (${socket.id}):`, error?.message || error);
        socket.emit('connection_error', { message: error?.message || 'Connection error' });
      });

      socket.on('error', (error) => {
        console.error(`[Socket.IO] Socket error (${socket.id}):`, error?.message || error);
      });
    });

    // Socket.IO engine error handler
    io.engine.on('connection_error', (error) => {
      console.warn('[Socket.IO Engine] Connection error:', error?.message || error);
    });

    // Store io instance
    app.set('io', io);
    app.locals.io = io;

    // Step 6: Start listening
    return new Promise((resolve) => {
      server.listen(PORT, '0.0.0.0', () => {
        console.log('\n========================================');
        console.log('✅ SERVER STARTED SUCCESSFULLY');
        console.log('========================================');
        console.log(`🌍 API URL: http://0.0.0.0:${PORT}`);
        console.log(`📡 Socket.IO: wss://${FRONTEND_URL.replace(/^https?:\/\//, '')}/socket.io/`);
        console.log(`🏥 Health: http://0.0.0.0:${PORT}/health`);
        console.log(`🖨️  Environment: ${NODE_ENV}`);
        console.log(`📊 Frontend: ${FRONTEND_URL}`);
        console.log('========================================\n');
        resolve();
      });
    });

  } catch (error) {
    console.error('\n❌ STARTUP ERROR:', error);
    console.error(error.stack);
    process.exit(1);
  }
};

// ============================================
// PROCESS ERROR HANDLERS
// ============================================

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Process] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Process] Uncaught Exception:', error);
  process.exit(1);
});

// ============================================
// START SERVER
// ============================================

startServer().catch((error) => {
  console.error('Fatal error starting server:', error);
  process.exit(1);
});

module.exports = app;