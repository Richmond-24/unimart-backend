const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

require('dotenv').config();

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 5000;
const NODE_ENV = process.env.NODE_ENV || 'production';
const MONGO_URI = (process.env.MONGO_URI || 'mongodb://localhost:27017/unimart').trim();
const JWT_SECRET = (process.env.JWT_SECRET || 'unimart-secret-key').trim();
const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://unimart.app,http://localhost:3000').trim();

const allowedOrigins = FRONTEND_URL.split(',').map((item) => item.trim()).filter(Boolean);

console.log('[server] Starting UniMart Backend');
console.log('[server] NODE_ENV:', NODE_ENV);
console.log('[server] FRONTEND_URL:', allowedOrigins);
console.log('[server] PORT:', PORT);

app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS policy: Origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
}));

if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10', 10),
  standardHeaders: true,
  legacyHeaders: false
});

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'OK',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
    socketConnections: app.get('io') ? app.get('io').engine.clientsCount : 0
  });
});

app.get('/socket-status', (req, res) => {
  const io = app.get('io');
  res.status(200).json({
    success: true,
    socketConnections: io ? io.engine.clientsCount : 0,
    path: '/socket.io'
  });
});

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'UniMart Backend is running',
    version: '1.0.0',
    docs: '/health'
  });
});

try {
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
  app.use('/api/search', require('./routes/search-enhanced.js'));
  app.use('/api', require('./routes/ai-search.routes.js'));
  app.use('/api/product-notifications', require('./routes/productNotifications.js'));
  app.use('/api/webhooks', require('./routes/webhooks.routes.js'));
} catch (routeError) {
  console.warn('[server] Route module load warning:', routeError.message);
}

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    method: req.method
  });
});

app.use((err, req, res, next) => {
  console.error('[server] Error:', err);
  const status = err.status || err.statusCode || 500;
  const message = NODE_ENV === 'development' ? err.message : 'Internal Server Error';
  res.status(status).json({
    success: false,
    message,
    ...(NODE_ENV === 'development' ? { stack: err.stack } : {})
  });
});

const startServer = async () => {
  try {
    console.log('[server] Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('[server] MongoDB connected');

    const server = http.createServer(app);
    const io = new Server(server, {
      cors: {
        origin: (origin, callback) => callback(null, true),
        credentials: true,
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
      },
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      allowEIO3: true,
      pingInterval: 25000,
      pingTimeout: 120000,
      connectTimeout: 45000,
      maxHttpBufferSize: 1e6,
      allowUpgrades: true
    });

    io.use((socket, next) => {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (token && typeof token === 'string' && token.trim()) {
        try {
          const decoded = jwt.verify(token.trim(), JWT_SECRET);
          socket.userId = decoded.userId || decoded.id || decoded._id || `anon-${Date.now()}`;
          socket.isAuthenticated = true;
        } catch (err) {
          socket.userId = `anon-${Date.now()}`;
          socket.isAuthenticated = false;
          console.warn('[socket] Invalid token, allowing anonymous connection');
        }
      } else {
        socket.userId = `anon-${Date.now()}`;
        socket.isAuthenticated = false;
      }
      next();
    });

    io.on('connection', (socket) => {
      console.log('[socket] connected', socket.id, 'user', socket.userId);
      socket.join(`user:${socket.userId}`);

      socket.on('message', (payload) => {
        console.log('[socket] message', payload);
        io.emit('message', { from: socket.id, payload, timestamp: new Date().toISOString() });
      });

      socket.on('ping', () => {
        socket.emit('pong', { timestamp: new Date().toISOString() });
      });

      socket.on('disconnect', (reason) => {
        console.log('[socket] disconnected', socket.id, reason);
      });

      socket.on('connect_error', (err) => {
        console.error('[socket] connect_error', err.message || err);
      });
    });

    app.set('io', io);

    server.listen(PORT, '0.0.0.0', () => {
      console.log('=============================================');
      console.log(`🚀 UniMart Backend running on port ${PORT}`);
      console.log('📡 Socket.IO path: wss://unimart.app/socket.io');
      console.log(`🌍 Health check: http://localhost:${PORT}/health`);
      console.log('=============================================');
    });
  } catch (error) {
    console.error('[server] Startup error:', error.message);
    process.exit(1);
  }
};

process.on('unhandledRejection', (err) => {
  console.error('[server] unhandledRejection:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('[server] uncaughtException:', err);
  process.exit(1);
});

startServer();

module.exports = app;
