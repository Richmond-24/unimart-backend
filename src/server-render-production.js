/**
 * UniMart Backend Server
 * Production-ready configuration for Render.com deployment
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

// Load environment variables
require('dotenv').config();

// ==================== CONSTANTS ====================
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/unimart';

// Parse FRONTEND_URL (comma-separated list) and include common dev origins
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://unimart-app-kappa.vercel.app';
const allowedOrigins = Array.from(new Set([
  FRONTEND_URL,
  'https://unimart-app-kappa.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
]).values()).filter(url => url.trim().length > 0);

console.log(`[${new Date().toISOString()}] 🚀 Starting UniMart Backend`);
console.log(`[${new Date().toISOString()}] 📝 Environment: ${NODE_ENV}`);
console.log(`[${new Date().toISOString()}] 🌐 FRONTEND_URL: ${FRONTEND_URL}`);
console.log(`[${new Date().toISOString()}] 🌐 Allowed Origins:`, allowedOrigins);
console.log(`[${new Date().toISOString()}] 🔌 Port: ${PORT}`);

// ==================== EXPRESS SETUP ====================
const app = express();
const server = http.createServer(app);

// Security middleware - more permissive for CORS issues
app.use(helmet({
  crossOriginResourcePolicy: false,
}));

// CORS configuration - ensures proper preflight handling
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl requests)
    if (!origin) return callback(null, true);

    // In production, allow any origin to prevent accidental CORS blocks
    // from the deployed frontend or temporary staging domains.
    if (NODE_ENV === 'production') {
      return callback(null, true);
    }

    const normalizedOrigin = origin.trim().replace(/\/+$|\s+/g, '');
    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    if (NODE_ENV === 'production') {
      return callback(null, true);
    }

    return callback(new Error(`CORS not allowed for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Length', 'X-JSON-Response'],
  optionsSuccessStatus: 200,
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle preflight for all routes

function applyCorsHeaders(req, res) {
  const origin = req.headers.origin || '*';
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Expose-Headers', 'Content-Length, X-JSON-Response, Access-Control-Allow-Origin');
  res.header('Access-Control-Max-Age', '86400');
}

// Additional CORS headers middleware (ensures headers on all responses)
app.use((req, res, next) => {
  applyCorsHeaders(req, res);
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// JSON parse error handler
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON payload. Please send valid JSON in the request body.'
    });
  }
  next(err);
});

// Logging middleware
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ==================== SOCKET.IO SETUP ====================
const io = new Server(server, {
  cors: {
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingInterval: 25000,
  pingTimeout: 120000,
  connectTimeout: 45000,
  maxHttpBufferSize: 1e6,
  maxPayload: 1e6,
  path: '/socket.io/',
  serveClient: false,
  cookie: false,
  perMessageDeflate: false,
  allowUpgrades: true,
  upgradeTimeout: 10000
});

console.log(`[${new Date().toISOString()}] ✅ Socket.IO configured`);

// ==================== SOCKET.IO AUTH & EVENTS ====================
const socketUsers = new Map(); // Map of userId -> socketId
const socketConnections = new Map(); // Map of socketId -> userInfo

io.use(async (socket, next) => {
  try {
    // Get token from auth or query
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (token && typeof token === 'string' && token.trim()) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.userId = decoded.userId || decoded.id || decoded._id;
        socket.isAuthenticated = true;
        socket.userEmail = decoded.email || null;
      } catch (err) {
        socket.isAuthenticated = false;
        socket.userId = `anon-${Date.now()}`;
        if (NODE_ENV === 'development') {
          console.warn(`[Socket.IO] Invalid token: ${err.message}`);
        }
      }
    } else {
      socket.isAuthenticated = false;
      socket.userId = `anon-${Date.now()}`;
    }

    next();
  } catch (error) {
    console.error(`[Socket.IO] Auth error: ${error.message}`);
    next();
  }
});

io.on('connection', (socket) => {
  const userId = String(socket.userId);
  
  socketConnections.set(socket.id, {
    userId,
    connectedAt: new Date().toISOString(),
    isAuthenticated: socket.isAuthenticated
  });

  socketUsers.set(userId, socket.id);

  console.log(`[${new Date().toISOString()}] ✅ Socket connected: ${socket.id} (User: ${userId})`);
  socket.emit('connection_established', { success: true, userId, socketId: socket.id });

  // Broadcast user online
  socket.join(`user:${userId}`);
  socket.broadcast.emit('user_online', { userId, socketId: socket.id });

  // ==================== CONVERSATION EVENTS ====================
  socket.on('join_conversation', (data) => {
    try {
      const { conversationId } = data;
      if (!conversationId) return socket.emit('error', { message: 'Conversation ID required' });

      socket.join(`conversation:${conversationId}`);
      socket.emit('joined_conversation', { conversationId, success: true });
      socket.to(`conversation:${conversationId}`).emit('user_joined_conversation', { userId, conversationId });
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  socket.on('leave_conversation', (data) => {
    try {
      const { conversationId } = data;
      if (!conversationId) return;

      socket.leave(`conversation:${conversationId}`);
      socket.to(`conversation:${conversationId}`).emit('user_left_conversation', { userId, conversationId });
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  socket.on('send_message', (data) => {
    try {
      const { conversationId, text, type = 'text' } = data;
      if (!conversationId || !text) return socket.emit('error', { message: 'Invalid message data' });

      const message = {
        _id: `msg-${Date.now()}`,
        conversationId,
        sender: userId,
        text,
        type,
        timestamp: new Date().toISOString()
      };

      io.to(`conversation:${conversationId}`).emit('new_message', message);
      socket.emit('message_sent', { message, success: true });
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  socket.on('typing', (data) => {
    try {
      const { conversationId } = data;
      if (!conversationId) return;

      socket.to(`conversation:${conversationId}`).emit('user_typing', { userId, conversationId });
    } catch (err) {
      console.error('Typing event error:', err.message);
    }
  });

  socket.on('stop_typing', (data) => {
    try {
      const { conversationId } = data;
      if (!conversationId) return;

      socket.to(`conversation:${conversationId}`).emit('user_stop_typing', { userId, conversationId });
    } catch (err) {
      console.error('Stop typing event error:', err.message);
    }
  });

  // ==================== PING/PONG HEARTBEAT ====================
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: new Date().toISOString() });
  });

  // ==================== DISCONNECT ====================
  socket.on('disconnect', (reason) => {
    socketConnections.delete(socket.id);
    socketUsers.delete(userId);
    socket.broadcast.emit('user_offline', { userId, reason });
    console.log(`[${new Date().toISOString()}] ❌ Socket disconnected: ${socket.id} (Reason: ${reason})`);
  });

  socket.on('error', (error) => {
    console.error(`[Socket.IO] Socket error: ${error}`);
  });

  socket.on('connect_error', (error) => {
    console.error(`[Socket.IO] Connection error: ${error.message}`);
    socket.emit('connection_error', { message: error.message });
  });
});

// ==================== API ROUTES ====================

// Static files
app.use('/uploads', express.static('uploads'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'OK',
    app: 'UniMart Backend',
    version: '1.0.0',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    socketConnections: io.engine.clientsCount
  });
});

// WebSocket status endpoint
app.get('/socket-status', (req, res) => {
  res.status(200).json({
    success: true,
    socketConnections: io.engine.clientsCount,
    authenticatedUsers: socketUsers.size,
    totalConnections: socketConnections.size,
    connections: Array.from(socketConnections.entries()).map(([socketId, info]) => ({
      socketId,
      ...info
    }))
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to UniMart API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      socketStatus: '/socket-status',
      api: '/api'
    }
  });
});

// API status
app.get('/api', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'UniMart API v1.0',
    documentation: 'https://github.com/unimart/backend'
  });
});

// ==================== ROUTE IMPORTS ====================
// Try to load routes if they exist, otherwise use mock routes

try {
  app.use('/api/auth', require('./routes/auth.routes.js'));
} catch (e) {
  console.warn('⚠️  Auth routes not found');
}

try {
  app.use('/api/products', require('./routes/product.routes.js'));
} catch (e) {
  console.warn('⚠️  Product routes not found');
}

try {
  app.use('/api/conversations', require('./routes/conversations.js'));
} catch (e) {
  console.warn('⚠️  Conversation routes not found');
}

try {
  app.use('/api/categories', require('./routes/category.routes.js'));
} catch (e) {
  console.warn('⚠️  Category routes not found');
}

try {
  app.use('/api/orders', require('./routes/order.routes.js'));
} catch (e) {
  console.warn('⚠️  Order routes not found');
}

try {
  app.use('/api/cart', require('./routes/cart.routes.js'));
} catch (e) {
  console.warn('⚠️  Cart routes not found');
}

try {
  app.use('/api/home', require('./routes/home.routes.js'));
} catch (e) {
  console.warn('⚠️  Home routes not found');
}

try {
  app.use('/api/public', require('./routes/public.routes.js'));
} catch (e) {
  console.warn('⚠️  Public routes not found');
}

try {
  app.use('/api/listings', require('./routes/listings.js'));
} catch (e) {
  console.warn('⚠️  Listings routes not found');
}

try {
  app.use('/api/sellers', require('./routes/seller.routes.js'));
} catch (e) {
  console.warn('⚠️  Seller routes not found');
}

try {
  app.use('/api/food', require('./routes/food.routes.js'));
} catch (e) {
  console.warn('⚠️  Food routes not found');
}

try {
  app.use('/api/services', require('./routes/service.routes.js'));
} catch (e) {
  console.warn('⚠️  Service routes not found');
}

try {
  app.use('/api/events', require('./routes/event.routes.js'));
} catch (e) {
  console.warn('⚠️  Event routes not found');
}

try {
  app.use('/api/upload', require('./routes/upload.routes.js'));
} catch (e) {
  console.warn('⚠️  Upload routes not found');
}

try {
  app.use('/api/riri', require('./routes/riri.routes.js'));
} catch (e) {
  console.warn('⚠️  RIRI routes not found');
}

// ==================== ERROR HANDLERS ====================

// 404 handler
app.use((req, res) => {
  applyCorsHeaders(req, res);
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Global error handler
app.use((err, req, res, next) => {
  applyCorsHeaders(req, res);
  console.error(`[${new Date().toISOString()}] Error: ${err.message}`, err.stack);

  const statusCode = err.statusCode || 500;
  const message = NODE_ENV === 'development' ? err.message : 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message,
    ...(NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ==================== SERVER START ====================
const startServer = async () => {
  try {
    // Connect to MongoDB
    console.log(`[${new Date().toISOString()}] 📚 Connecting to MongoDB...`);
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log(`[${new Date().toISOString()}] ✅ MongoDB connected`);

    // Start HTTP server
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`🚀 UniMart Backend Server Started`);
      console.log(`${'='.repeat(50)}`);
      console.log(`📡 Port: ${PORT}`);
      console.log(`🌍 Environment: ${NODE_ENV}`);
      console.log(`🔗 URL: http://0.0.0.0:${PORT}`);
      console.log(`💬 WebSocket: ws://0.0.0.0:${PORT}/socket.io/`);
      console.log(`🏥 Health Check: http://0.0.0.0:${PORT}/health`);
      console.log(`${'='.repeat(50)}\n`);

      // Store io instance on app
      app.set('io', io);
      app.set('socketUsers', socketUsers);
    });

    // Handle server errors
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
      } else {
        console.error(`❌ Server error: ${err.message}`);
      }
      process.exit(1);
    });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Failed to start server:`, error.message);
    if (error.name === 'MongoServerError') {
      console.error('MongoDB Error - check MONGO_URI in .env file');
    }
    process.exit(1);
  }
};

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
  console.error(`[${new Date().toISOString()}] ❌ Unhandled Promise Rejection:`, err.message);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error(`[${new Date().toISOString()}] ❌ Uncaught Exception:`, err.message);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log(`[${new Date().toISOString()}] 📴 SIGTERM received, shutting down gracefully...`);
  server.close(() => {
    console.log(`[${new Date().toISOString()}] ✅ Server closed`);
    mongoose.connection.close(false, () => {
      console.log(`[${new Date().toISOString()}] ✅ MongoDB connection closed`);
      process.exit(0);
    });
  });
});

// Start server
startServer();

module.exports = { app, server, io };
