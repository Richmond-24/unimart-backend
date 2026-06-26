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
const PORT = Number(process.env.PORT || 5000);
const NODE_ENV = process.env.NODE_ENV || 'production';
const MONGO_URI = (process.env.MONGO_URI || 'mongodb://localhost:27017/unimart').trim();
const JWT_SECRET = (process.env.JWT_SECRET || 'unimart-secret-key').trim();
const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://unimart-app-kappa.vercel.app').trim();

const allowedOrigins = [
  FRONTEND_URL,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]
  .filter(Boolean)
  .map((origin) => origin.replace(/\/+$/, ''));

const onrenderOriginPattern = /^https?:\/\/([a-z0-9-]+\.)*onrender\.com$/i;

function isOriginAllowed(origin) {
  if (!origin) return true;
  const normalized = origin.trim().replace(/\/+$/, '');
  return allowedOrigins.includes(normalized) || onrenderOriginPattern.test(normalized);
}

console.log('[server] Starting UniMart Backend');
console.log('[server] NODE_ENV:', NODE_ENV);
console.log('[server] FRONTEND_URLS:', allowedOrigins);
console.log('[server] PORT:', PORT);

app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || isOriginAllowed(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS policy blocked: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200,
  preflightContinue: false,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || '10'),
  standardHeaders: true,
  legacyHeaders: false,
});

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'OK',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
    socketConnections: app.get('io') ? app.get('io').engine.clientsCount : 0,
  });
});

app.get('/socket-status', (req, res) => {
  const io = app.get('io');
  res.status(200).json({
    success: true,
    socketConnections: io ? io.engine.clientsCount : 0,
    path: '/socket.io',
  });
});

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'UniMart Backend is running',
    version: '1.0.0',
    docs: '/health',
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
    method: req.method,
  });
});

app.use((err, req, res, next) => {
  console.error('[server] Error:', err);
  const status = err.status || err.statusCode || 500;
  const message = NODE_ENV === 'development' ? err.message : 'Internal Server Error';
  res.status(status).json({
    success: false,
    message,
    ...(NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
});

const startServer = async () => {
  try {
    console.log('[server] Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('[server] MongoDB connected');

    const server = http.createServer(app);
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 120000;
    server.setTimeout(120000);

    const io = new Server(server, {
      cors: {
        origin: (origin, callback) => {
          if (!origin || isOriginAllowed(origin)) {
            return callback(null, true);
          }
          return callback(new Error(`Socket.IO CORS blocked: ${origin}`));
        },
        credentials: true,
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      },
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      allowEIO3: true,
      pingInterval: 25000,
      pingTimeout: 60000,
      connectTimeout: 45000,
      timeout: 60000,
      maxHttpBufferSize: 1e6,
      allowUpgrades: true,
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
          console.warn('[socket] Invalid token received during handshake');
        }
      } else {
        socket.userId = `anon-${Date.now()}`;
        socket.isAuthenticated = false;
      }
      next();
    });

    io.on('connection', (socket) => {
      const origin = socket.handshake.headers.origin || socket.request.headers.origin || 'unknown';
      const transportName = socket.conn.transport.name;
      console.log('[socket] connected', {
        socketId: socket.id,
        userId: socket.userId,
        authenticated: socket.isAuthenticated,
        transport: transportName,
        origin,
        time: new Date().toISOString(),
      });

      socket.join(`user:${socket.userId}`);

      socket.emit('server:connected', {
        timestamp: new Date().toISOString(),
        socketId: socket.id,
        transport: transportName,
      });

      socket.on('health:ping', () => {
        socket.emit('health:pong', {
          timestamp: new Date().toISOString(),
          socketId: socket.id,
          origin,
        });
      });

      socket.on('message', (payload) => {
        console.log('[socket] message', { socketId: socket.id, payload });
        io.emit('message', { from: socket.id, payload, timestamp: new Date().toISOString() });
      });

      socket.on('disconnect', (reason) => {
        console.log('[socket] disconnected', { socketId: socket.id, reason });
      });

      socket.on('connect_error', (err) => {
        console.error('[socket] connect_error', err?.message || err);
      });

      socket.on('error', (err) => {
        console.error('[socket] error', err?.message || err);
      });
    });

    io.engine.on('connection_error', (error) => {
      console.warn('[socket] engine connection_error', error.message || error);
    });

    app.set('io', io);
    app.locals.io = io;

    server.listen(PORT, '0.0.0.0', () => {
      console.log('=============================================');
      console.log(`🚀 UniMart Backend running on port ${PORT}`);
      console.log('📡 Socket.IO path: https://unimart-backends-2.onrender.com/socket.io');
      console.log(`🌍 Health check: http://localhost:${PORT}/health`);
      console.log('=============================================');
    });
  } catch (error) {
    console.error('[server] Startup error:', error);
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
