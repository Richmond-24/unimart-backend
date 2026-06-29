const { verifyToken } = require('../utils/generateToken');

/**
 * Middleware to verify JWT token and attach user to request
 */
const authMiddleware = (req, res, next) => {
  try {
    // Get token from headers
    const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No authentication token. Please provide a valid token.',
      });
    }

    // Verify token
    const decoded = verifyToken(token);
    req.user = decoded;
    req.token = token;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token verification failed. Please login again.',
    });
  }
};

/**
 * Middleware to check user role
 * @param {string|string[]} allowedRoles - Role(s) allowed to access
 */
const roleMiddleware = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (!rolesArray.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. This endpoint requires one of these roles: ${rolesArray.join(', ')}`,
      });
    }

    next();
  };
};

/**
 * Middleware for seller-only endpoints
 */
const sellerMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
    });
  }

  if (req.user.role !== 'seller' && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'This action is only available for sellers.',
    });
  }

  next();
};

/**
 * Middleware for admin-only endpoints
 */
const adminMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'This action requires administrator privileges.',
    });
  }

  next();
};

/**
 * Optional auth middleware - doesn't fail if token is missing/invalid
 * Useful for endpoints that work with or without authentication
 */
const optionalAuthMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;

    if (token) {
      const decoded = verifyToken(token);
      req.user = decoded;
      req.token = token;
    }
  } catch (error) {
    // Silently ignore errors for optional auth
  }

  next();
};

/**
 * Rate limiting middleware for auth endpoints
 */
const authRateLimitMiddleware = (req, res, next) => {
  // Simple in-memory rate limiting
  // For production, use redis or express-rate-limit package

  const ip = req.ip;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 5; // Max 5 requests per window

  if (!global.rateLimitStore) {
    global.rateLimitStore = {};
  }

  if (!global.rateLimitStore[ip]) {
    global.rateLimitStore[ip] = {
      count: 0,
      resetTime: now + windowMs,
    };
  }

  const userLimit = global.rateLimitStore[ip];

  if (now > userLimit.resetTime) {
    userLimit.count = 0;
    userLimit.resetTime = now + windowMs;
  }

  userLimit.count++;

  if (userLimit.count > maxRequests) {
    return res.status(429).json({
      success: false,
      message: `Too many authentication attempts. Please try again in ${Math.ceil((userLimit.resetTime - now) / 1000)} seconds.`,
    });
  }

  next();
};

module.exports = {
  authMiddleware,
  roleMiddleware,
  sellerMiddleware,
  adminMiddleware,
  optionalAuthMiddleware,
};
