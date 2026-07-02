const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const router = express.Router();
const mongoose = require('mongoose');

const { protect } = require('../middleware/auth.middleware');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User.model');
const Product = require('../models/Product.model');

// Helper to get normalized userId from req.user
function getReqUserId(req) {
  return req.user?.id || req.user?.userId || (req.user && req.user.id) || null;
}

// Create or get existing conversation
router.post('/'
  , protect
  , body('sellerId').optional().isMongoId()
  , body('sellerEmail').optional().isEmail()
  , body('productId').optional().isMongoId()
  , body('initialMessage').optional().isString().isLength({ min: 1 })
  , async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

      const buyerId = getReqUserId(req);
      const { sellerId, sellerEmail, productId, initialMessage } = req.body;
      let resolvedSellerId = sellerId;

      if (!buyerId) return res.status(401).json({ success: false, message: 'Unauthorized' });
      if (!sellerId && !sellerEmail) return res.status(400).json({ success: false, message: 'sellerId or sellerEmail is required' });

      if (!resolvedSellerId && sellerEmail) {
        const seller = await User.findOne({ email: String(sellerEmail).toLowerCase().trim() }).lean();
        if (!seller) return res.status(404).json({ success: false, message: 'Seller not found' });
        resolvedSellerId = seller._id.toString();
      }
      if (!mongoose.Types.ObjectId.isValid(resolvedSellerId)) {
        return res.status(400).json({ success: false, message: 'Invalid seller identifier' });
      }

      if (buyerId.toString() === resolvedSellerId) return res.status(400).json({ success: false, message: 'Buyer and seller cannot be the same' });

      // Try to find existing conversation for this buyer/seller/product
      const query = { participants: { $all: [mongoose.Types.ObjectId(buyerId), mongoose.Types.ObjectId(resolvedSellerId)] } };
      if (productId) query.product = mongoose.Types.ObjectId(productId);

      let convo = await Conversation.findOne(query).lean();
      if (!convo) {
        // Create conversation
        const buyer = await User.findById(buyerId).lean();
        const seller = await User.findById(resolvedSellerId).lean();
        const product = productId ? await Product.findById(productId).lean() : null;

        const convData = {
          participants: [buyerId, resolvedSellerId],
          product: productId || null,
          productName: product ? (product.name || '') : undefined,
          productImage: product ? (product.images && product.images[0]) : undefined,
          price: product ? product.price : undefined,
          buyer: { id: buyer?._id, name: buyer?.name || '', photoURL: buyer?.photoURL || '' },
          seller: { id: seller?._id, name: seller?.name || '', photoURL: seller?.photoURL || '' },
          lastMessage: initialMessage ? { text: initialMessage, senderId: buyerId, timestamp: new Date() } : undefined,
          unreadCount: {},
        };

        convo = await Conversation.create(convData);
      }

      // Return populated conversation
      const populated = await Conversation.findById(convo._id).populate('participants', 'name email photoURL');
      return res.json({ success: true, conversation: populated });
    } catch (err) {
      console.error('Create conversation error', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

// Get user's conversations
router.get('/', protect, async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const conversations = await Conversation.find({ participants: userId })
      .sort({ updatedAt: -1 })
      .limit(50)
      .populate('buyer.id seller.id', 'name photoURL email')
      .lean();

    // Ensure unread counts present
    const result = conversations.map((c) => {
      const unread = c.unreadCount || {};
      const unreadForUser = unread.get ? unread.get(String(userId)) || 0 : (unread[String(userId)] || 0);
      return { ...c, unreadForUser };
    });

    return res.json({ success: true, conversations: result });
  } catch (err) {
    console.error('Fetch conversations error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get single conversation
router.get('/:id', protect, param('id').isMongoId(), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const userId = getReqUserId(req);
    const { id } = req.params;

    const conversation = await Conversation.findById(id).populate('participants', 'name email photoURL');
    if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found' });
    if (!conversation.participants.map(p => p._id.toString()).includes(String(userId))) {
      return res.status(403).json({ success: false, message: 'Not a participant' });
    }

    return res.json({ success: true, conversation });
  } catch (err) {
    console.error('Get conversation error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get messages for a conversation with pagination
router.get('/:id/messages', protect, param('id').isMongoId(), query('page').optional().toInt(), query('limit').optional().toInt(), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const userId = getReqUserId(req);
    const { id } = req.params;
    const page = Math.max(0, req.query.page || 0);
    const limit = Math.min(100, req.query.limit || 30);

    const conversation = await Conversation.findById(id);
    if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found' });
    if (!conversation.participants.map(p => p.toString()).includes(String(userId))) {
      return res.status(403).json({ success: false, message: 'Not a participant' });
    }

    const messages = await Message.find({ conversation: id })
      .sort({ timestamp: -1 })
      .skip(page * limit)
      .limit(limit)
      .populate('sender', 'name photoURL')
      .lean();

    // Mark unread messages as read and reset unreadCount for the current user
    const unreadFilter = { conversation: id, read: false, sender: { $ne: userId } };
    await Message.updateMany(unreadFilter, { $set: { read: true, readAt: new Date() } });

    // Reset unread count for user in conversation
    if (conversation.unreadCount) {
      if (conversation.unreadCount instanceof Map) {
        conversation.unreadCount.set(String(userId), 0);
      } else {
        conversation.unreadCount[String(userId)] = 0;
      }
      await conversation.save();
    }

    return res.json({ success: true, messages });
  } catch (err) {
    console.error('Get messages error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Sync messages from Firebase (or client) to MongoDB
router.post('/:id/sync', protect, param('id').isMongoId(), body('messages').isArray(), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const userId = getReqUserId(req);
    const { id } = req.params;
    const { messages } = req.body; // array of { firebaseId, senderId, text, type, imageUrl, timestamp }

    const conversation = await Conversation.findById(id);
    if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found' });
    if (!conversation.participants.map(p => p.toString()).includes(String(userId))) {
      return res.status(403).json({ success: false, message: 'Not a participant' });
    }

    // Upsert messages by firebaseId to avoid duplicates
    const inserted = [];
    for (const m of messages) {
      if (!m.firebaseId) continue; // require id for dedupe
      const exists = await Message.findOne({ firebaseId: m.firebaseId, conversation: id }).lean();
      if (exists) continue;

      const doc = await Message.create({
        conversation: id,
        firebaseId: m.firebaseId,
        sender: m.senderId,
        text: m.text || '',
        type: m.type || 'text',
        imageUrl: m.imageUrl,
        timestamp: m.timestamp ? new Date(m.timestamp) : new Date()
      });
      inserted.push(doc);
    }

    if (inserted.length) {
      // update conversation lastMessage and unread counts
      const last = inserted[inserted.length - 1];
      const otherParticipant = conversation.participants.find(p => p.toString() !== String(last.sender));
      await Conversation.findByIdAndUpdate(id, {
        lastMessage: { text: last.text, senderId: last.sender, timestamp: last.timestamp },
        $inc: { [`unreadCount.${otherParticipant}`]: inserted.length },
        updatedAt: new Date()
      });
    }

    return res.json({ success: true, insertedCount: inserted.length });
  } catch (err) {
    console.error('Sync messages error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;

