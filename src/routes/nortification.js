const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');

// Get unread count & notifications
router.get('/', async (req, res) => {
  const { userId, unreadOnly } = req.query;
  const filter = { userId };
  if (unreadOnly === 'true') filter.read = false;
  const notifications = await Notification.find(filter).sort({ createdAt: -1 }).limit(50);
  const unreadCount = await Notification.countDocuments({ userId, read: false });
  res.json({ success: true, notifications, unreadCount });
});

// Mark as read
router.patch('/:id/read', async (req, res) => {
  await Notification.findByIdAndUpdate(req.params.id, { read: true });
  res.json({ success: true });
});

// Create a notification (used internally)
const createNotification = async (userId, type, title, body, data = {}) => {
  await Notification.create({ userId, type, title, body, data });
};

module.exports = { router, createNotification };