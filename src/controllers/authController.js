const axios = require('axios');
const User = require('../models/User.model');
const { generateToken, generateRefreshToken } = require('../utils/generateToken');
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
} = require('../utils/emailService');
const crypto = require('crypto');

/**
 * Register a new user
 * POST /api/auth/register
 * Body: { name, email, password, university?, studentId?, phone? }
 */
const register = async (req, res) => {
  try {
    const { name, email, password, university, studentId, phone, location, locationCoords } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password.',
      });
    }

    if (name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Name must be at least 2 characters long.',
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered. Please use a different email or login.',
      });
    }

    // Create user
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase(),
      password,
      university: university || '',
      studentId: studentId || '',
      phone: phone || '',
      // optional location info provided from client
      location: location || '',
      locationCoords: (locationCoords && typeof locationCoords === 'object') ? {
        lat: Number(locationCoords.lat) || null,
        lon: Number(locationCoords.lon) || null,
      } : undefined,
      role: 'buyer',
      isActive: true,
    });

    await user.save();

    // Create a welcome notification/message for the new user and badge summary.
    try {
      const nort = require('../routes/nortification');
      if (nort && typeof nort.createNotification === 'function') {
        await nort.createNotification(user._id, 'system', '🎉 Welcome to UniMart!', `Thanks for joining — enjoy your Early Bird badge. Explore trusted campus sellers and enjoy your first-time perks!`, { badge: 'EARLY_BIRD' });
        await nort.createNotification(user._id, 'badge_unlocked', 'You unlocked 2 badges!', 'You have earned Verified User and Early Bird badges. Verified means your account is trusted and ready for campus buying. Early Bird means you joined UniMart early and get special welcome perks.', { badges: ['VERIFIED_USER', 'EARLY_BIRD'] });
      }
    } catch (notifErr) {
      console.warn('Failed to create welcome notification:', notifErr?.message || notifErr);
    }

    // Fire-and-forget: notify Zapier (server-side) so webhook URL is not exposed to clients.
    // Do NOT include sensitive data (password, tokens, locationCoords, etc.).
    try {
      const zapierUrl = process.env.ZAPIER_WEBHOOK_URL;
      if (zapierUrl) {
        // minimal payload for email step
        const names = (user.name || '').trim().split(/\s+/);
        const firstName = names.length ? names[0] : '';
        const lastName = names.length > 1 ? names.slice(1).join(' ') : '';

        const payload = {
          id: user._id,
          email: user.email,
          name: user.name,
          firstName,
          lastName,
          role: user.role,
          signupAt: new Date().toISOString(),
        };

        const zapResp = await axios.post(zapierUrl, payload, { timeout: 5000 });

        if (zapResp && zapResp.status >= 200 && zapResp.status < 300) {
          console.log(`Zapier webhook sent for user=${user.email} status=${zapResp.status}`);
          try { console.log('Zapier response body:', typeof zapResp.data === 'object' ? JSON.stringify(zapResp.data) : zapResp.data); } catch (e) { console.log('Zapier response (raw):', zapResp.data); }
        } else {
          console.warn('Zapier webhook returned non-2xx:', zapResp && zapResp.status, zapResp && zapResp.data);
        }

        // Append backup record for audit/retry (non-blocking)
        try {
          const fs = require('fs');
          const backup = {
            ts: new Date().toISOString(),
            payload,
            zapStatus: zapResp && zapResp.status ? zapResp.status : 'unknown',
            zapResponse: zapResp && zapResp.data ? zapResp.data : null,
          };
          fs.appendFile('zap_backups.jsonl', JSON.stringify(backup) + '\n', (err) => { if (err) console.warn('Failed to write zap backup:', err); });
        } catch (bErr) {
          console.warn('Zap backup error:', bErr?.message || bErr);
        }
      } else {
        console.log('No ZAPIER_WEBHOOK_URL configured; skipping Zapier notification');
        // still write a skipped backup record
        try {
          const fs = require('fs');
          const backup = { ts: new Date().toISOString(), payload: { email: user.email, name: user.name }, zapStatus: 'skipped' };
          fs.appendFile('zap_backups.jsonl', JSON.stringify(backup) + '\n', (err) => { if (err) console.warn('Failed to write zap backup:', err); });
        } catch (bErr) { console.warn('Zap backup error:', bErr?.message || bErr); }
      }
    } catch (zapErr) {
      // log but don't fail registration if notification fails
      console.warn('Zapier webhook error (non-fatal):', zapErr?.message || zapErr);
      try {
        const fs = require('fs');
        const backup = { ts: new Date().toISOString(), payload: { email: user.email, name: user.name }, zapStatus: 'error', error: zapErr?.message || String(zapErr) };
        fs.appendFile('zap_backups.jsonl', JSON.stringify(backup) + '\n', (err) => { if (err) console.warn('Failed to write zap backup:', err); });
      } catch (bErr) { console.warn('Zap backup error:', bErr?.message || bErr); }
    }

    // Persist a welcome conversation + message so new users see it in Messages
    (async () => {
      try {
        const Conversation = require('../models/Conversation');
        const Message = require('../models/Message');
        const UserModel = require('../models/User.model');

        // Find or create a system/admin user to act as the sender
        const systemEmail = process.env.SYSTEM_USER_EMAIL || 'system@unimart.local';
        let systemUser = await UserModel.findOne({ email: systemEmail }).exec();
        if (!systemUser) {
          systemUser = new UserModel({
            name: process.env.SYSTEM_USER_NAME || 'UniMart',
            email: systemEmail,
            password: crypto.randomBytes(16).toString('hex'),
            role: 'admin',
            isActive: true,
            isVerified: true,
          });
          await systemUser.save();
        }

        // Create or reuse a conversation between systemUser and the new user
        let convo = await Conversation.findOne({ participants: { $all: [user._id, systemUser._id] } }).exec();
        if (!convo) {
          convo = await Conversation.create({
            participants: [user._id, systemUser._id],
            buyer: { id: user._id, name: user.name, photoURL: user.avatar || '' },
            seller: { id: systemUser._id, name: systemUser.name, photoURL: systemUser.avatar || '' },
            lastMessage: { text: 'Welcome!', senderId: systemUser._id, timestamp: new Date() },
          });
        }

        // Create welcome message in conversation
        const welcomeText = `🎉 Hi ${user.name.split(' ')[0] || ''}! Welcome to UniMart — enjoy your Early Bird badge and explore trusted campus sellers.`;
        const msg = await Message.create({
          conversation: convo._id,
          sender: systemUser._id,
          text: welcomeText,
          type: 'system',
          timestamp: new Date(),
        });

        // Update conversation lastMessage and unread count for the new user
        convo.lastMessage = { text: msg.text, senderId: systemUser._id, timestamp: msg.timestamp };
        convo.unreadCount = convo.unreadCount || new Map();
        if (typeof convo.unreadCount.get === 'function') {
          const prev = convo.unreadCount.get(String(user._id)) || 0;
          convo.unreadCount.set(String(user._id), prev + 1);
        } else {
          convo.unreadCount = { ...(convo.unreadCount || {}), [String(user._id)]: ((convo.unreadCount && convo.unreadCount[String(user._id)]) || 0) + 1 };
        }
        await convo.save();

        // Emit via socket.io if available (best-effort)
        try {
          const app = require('../server');
          const io = app && typeof app.get === 'function' ? app.get('io') : null;
          if (io) {
            io.to(`user:${String(user._id)}`).emit('new_message', { message: msg, conversationId: convo._id });
          }
        } catch (e) {
          // ignore socket emit errors
        }
      } catch (e) {
        console.warn('Failed to persist welcome conversation/message:', e?.message || e);
      }
    })();

    // Generate token
    const token = user.getSignedJwt();

    res.status(201).json({
      success: true,
      message: 'Registration successful! Welcome to UniMart.',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        university: user.university,
        studentId: user.studentId,
        avatar: user.avatar,
        role: user.role,
        isActive: user.isActive,
        location: user.location || '',
        locationCoords: user.locationCoords || null,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.',
      error: error.message,
    });
  // Wrapper: re-export the stable auth.controller implementation to recover from
  // a previously corrupted file. This keeps both `auth.controller.js` and
  // `authController.js` require paths working across the codebase.
  module.exports = require('./auth.controller');
 * Check if email is available for signup
