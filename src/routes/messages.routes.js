/**
 * Messages Routes
 * Temu-style buyer-seller messaging
 * Route: /api/messages
 */

const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const { protect } = require('../middleware/auth.middleware');
const {
  sendMessage,
  getSellerConversations,
  getSellerConversationMessages,
  markMessagesAsRead,
  getBuyerConversations
} = require('../controllers/messages.controller');

// Middleware to check validation
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

// ========== BUYER ROUTES ==========

/**
 * GET /api/messages/conversations
 * Get all buyer's conversations with sellers
 */
router.get(
  '/conversations',
  protect,
  getBuyerConversations
);

/**
 * POST /api/messages
 * Send a message
 */
router.post(
  '/',
  protect,
  body('conversationId').isMongoId(),
  body('text').trim().notEmpty(),
  body('type').optional().isIn(['text', 'image', 'offer']),
  body('imageUrl').optional().isURL(),
  handleValidationErrors,
  sendMessage
);

/**
 * PUT /api/messages/:conversationId/read
 * Mark messages as read
 */
router.put(
  '/:conversationId/read',
  protect,
  param('conversationId').isMongoId(),
  handleValidationErrors,
  markMessagesAsRead
);

// ========== SELLER ROUTES ==========

/**
 * GET /api/messages/seller/conversations
 * Get all seller's conversations (messages from buyers)
 */
router.get(
  '/seller/conversations',
  protect,
  getSellerConversations
);

/**
 * GET /api/messages/seller/conversations/:id
 * Get messages for a specific conversation (seller view)
 */
router.get(
  '/seller/conversations/:id',
  protect,
  param('id').isMongoId(),
  query('page').optional().toInt(),
  query('limit').optional().toInt(),
  handleValidationErrors,
  getSellerConversationMessages
);

module.exports = router;
