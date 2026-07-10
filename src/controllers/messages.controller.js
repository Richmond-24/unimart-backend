/**
 * Messages Controller
 * Handles buyer-seller messaging (Temu-style chat)
 * No auto-responses, proper routing between buyer and seller
 */

const mongoose = require('mongoose');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User.model');
const Notification = require('../models/Notification');

// Helper to normalize user ID
function getNormalizedUserId(req) {
  return req.user?.id || req.user?.userId || (req.user && req.user.id) || null;
}

/**
 * Send a message from buyer to seller (or seller to buyer)
 * POST /api/messages
 */
const sendMessage = async (req, res) => {
  try {
    const senderId = getNormalizedUserId(req);
    if (!senderId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { conversationId, text, type = 'text', imageUrl = null } = req.body;
    if (!conversationId || !text) {
      return res.status(400).json({ success: false, message: 'conversationId and text are required' });
    }

    // Verify conversation exists and user is a participant
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found' });

    const participantIds = conversation.participants.map(p => String(p));
    if (!participantIds.includes(String(senderId))) {
      return res.status(403).json({ success: false, message: 'Not a participant in this conversation' });
    }

    // Create message
    const message = new Message({
      conversation: conversationId,
      sender: senderId,
      text: text.trim(),
      type,
      imageUrl,
      read: false,
      timestamp: new Date()
    });

    const savedMessage = await message.save();
    const populatedMessage = await Message.findById(savedMessage._id).populate('sender', 'name photoURL email');

    // Update conversation lastMessage and unreadCount
    const otherParticipants = participantIds.filter(p => p !== String(senderId));
    const incUpdate = {};
    otherParticipants.forEach(participantId => {
      incUpdate[`unreadCount.${participantId}`] = 1;
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: {
        text: savedMessage.text,
        senderId: savedMessage.sender,
        timestamp: savedMessage.timestamp
      },
      ...(Object.keys(incUpdate).length > 0 && { $inc: incUpdate }),
      updatedAt: new Date()
    });

    // Create notifications for other participants
    try {
      const sender = await User.findById(senderId).lean();
      const senderName = sender?.name || 'Someone';

      const notificationPromises = otherParticipants.map(recipientId =>
        Notification.create({
          userId: recipientId,
          type: 'new_message',
          title: `New message from ${senderName}`,
          body: String(text).slice(0, 140),
          data: { conversationId, senderId, messageId: savedMessage._id }
        })
      );

      await Promise.all(notificationPromises);

      // Emit real-time Socket.IO events so both sides update instantly
      try {
        const io = req.app?.get?.('io');
        if (io) {
          // Broadcast to all participants in the conversation room
          io.to(`conversation:${conversationId}`).emit('new_message', {
            ...populatedMessage.toObject ? populatedMessage.toObject() : populatedMessage,
            conversationId,
          });

          // Emit per-user events for dashboard/notification updates
          const fromRole = String(senderId) === String(conversation.seller?.id) ? 'seller' : 'buyer';
          otherParticipants.forEach(recipientId => {
            io.to(`user:${recipientId}`).emit('seller:new_message', {
              conversationId,
              message: populatedMessage.toObject ? populatedMessage.toObject() : populatedMessage,
              from: fromRole,
            });
            io.to(`user:${recipientId}`).emit('notification_received', {
              count: 1,
              type: 'new_message',
              conversationId,
              sender: senderId,
              senderName,
            });
          });
        }
      } catch (socketErr) {
        console.warn('⚠️ Failed to emit socket event:', socketErr?.message || socketErr);
      }
    } catch (notifyErr) {
      console.warn('Failed to create notifications:', notifyErr?.message);
    }

    return res.json({
      success: true,
      message: populatedMessage
    });
  } catch (err) {
    console.error('Send message error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Get seller's conversations (messages from buyers)
 * GET /api/sellers/messages/conversations
 */
const getSellerConversations = async (req, res) => {
  try {
    const sellerId = getNormalizedUserId(req);
    if (!sellerId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    // Verify user is a seller
    const user = await User.findById(sellerId).lean();
    if (!user || user.role !== 'seller') {
      return res.status(403).json({ success: false, message: 'Only sellers can access this' });
    }

    // Get all conversations this seller is in
    const conversations = await Conversation.find({ participants: sellerId })
      .sort({ updatedAt: -1 })
      .limit(100)
      .populate('buyer.id seller.id', 'name photoURL email')
      .lean();

    // Enhance with unread counts and latest messages
    const enhanced = conversations.map(c => {
      const unreadCount = c.unreadCount && c.unreadCount[String(sellerId)] ? c.unreadCount[String(sellerId)] : 0;
      return {
        ...c,
        unreadCount,
        unreadForSeller: unreadCount
      };
    });

    return res.json({
      success: true,
      conversations: enhanced,
      total: enhanced.length
    });
  } catch (err) {
    console.error('Get seller conversations error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Get messages for seller (all messages in a conversation they're part of)
 * GET /api/sellers/messages/conversations/:id
 */
const getSellerConversationMessages = async (req, res) => {
  try {
    const sellerId = getNormalizedUserId(req);
    if (!sellerId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;
    const page = Math.max(0, req.query.page || 0);
    const limit = Math.min(100, req.query.limit || 30);

    // Verify user is a seller
    const user = await User.findById(sellerId).lean();
    if (!user || user.role !== 'seller') {
      return res.status(403).json({ success: false, message: 'Only sellers can access this' });
    }

    // Get conversation and verify seller is a participant
    const conversation = await Conversation.findById(id);
    if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found' });

    const participantIds = conversation.participants.map(p => String(p));
    if (!participantIds.includes(String(sellerId))) {
      return res.status(403).json({ success: false, message: 'Not a participant' });
    }

    // Get messages
    const messages = await Message.find({ conversation: id })
      .sort({ timestamp: -1 })
      .skip(page * limit)
      .limit(limit)
      .populate('sender', 'name photoURL email role')
      .lean();

    // Mark messages from buyer as read in database
    await Message.updateMany(
      { conversation: id, read: false, sender: { $ne: sellerId } },
      { $set: { read: true, readAt: new Date() } }
    );

    // Reset unread count for this seller
    await Conversation.findByIdAndUpdate(id, {
      $set: { [`unreadCount.${sellerId}`]: 0 }
    });

    return res.json({
      success: true,
      messages: messages.reverse(),
      conversation
    });
  } catch (err) {
    console.error('Get seller messages error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Mark messages as read by buyer
 * PUT /api/messages/:conversationId/read
 */
const markMessagesAsRead = async (req, res) => {
  try {
    const userId = getNormalizedUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { conversationId } = req.params;

    // Verify user is a participant
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found' });

    const participantIds = conversation.participants.map(p => String(p));
    if (!participantIds.includes(String(userId))) {
      return res.status(403).json({ success: false, message: 'Not a participant' });
    }

    // Mark all unread messages from other participants as read
    const result = await Message.updateMany(
      { conversation: conversationId, read: false, sender: { $ne: userId } },
      { $set: { read: true, readAt: new Date() } }
    );

    // Reset unread count for this user
    await Conversation.findByIdAndUpdate(conversationId, {
      $set: { [`unreadCount.${userId}`]: 0 }
    });

    return res.json({
      success: true,
      modifiedCount: result.modifiedCount
    });
  } catch (err) {
    console.error('Mark as read error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Get buyer's conversations (messages with sellers)
 * GET /api/messages/conversations
 */
const getBuyerConversations = async (req, res) => {
  try {
    const buyerId = getNormalizedUserId(req);
    if (!buyerId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const conversations = await Conversation.find({ participants: buyerId })
      .sort({ updatedAt: -1 })
      .limit(100)
      .populate('buyer.id seller.id', 'name photoURL email')
      .lean();

    const enhanced = conversations.map(c => {
      const unreadCount = c.unreadCount && c.unreadCount[String(buyerId)] ? c.unreadCount[String(buyerId)] : 0;
      return {
        ...c,
        unreadCount,
        unreadForBuyer: unreadCount
      };
    });

    return res.json({
      success: true,
      conversations: enhanced,
      total: enhanced.length
    });
  } catch (err) {
    console.error('Get buyer conversations error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  sendMessage,
  getSellerConversations,
  getSellerConversationMessages,
  markMessagesAsRead,
  getBuyerConversations
};
