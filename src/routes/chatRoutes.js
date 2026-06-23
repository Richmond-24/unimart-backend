// unimart-backend/src/routes/chatRoutes.js
// Stream Chat Integration Routes
// Copy this file to your backend and register it in server.js

const express = require('express');
const { StreamChat } = require('stream-chat');
const router = express.Router();

// Initialize Stream Chat with credentials from environment
const streamChat = new StreamChat(
  process.env.STREAM_CHAT_API_KEY,
  process.env.STREAM_CHAT_API_SECRET
);

// ============================================
// AUTHENTICATION & TOKEN GENERATION
// ============================================

/**
 * POST /api/chat/token
 * Generate JWT token for Stream Chat authentication
 * 
 * This is called from the mobile app after user login
 * to get a token for secure Stream Chat communication
 * 
 * Request Body:
 * {
 *   "userId": "user123",
 *   "expiresIn": 86400 (optional, default 24 hours)
 * }
 * 
 * Response:
 * {
 *   "token": "eyJhbGc...",
 *   "userId": "user123",
 *   "expiresAt": "2026-04-04T12:00:00.000Z"
 * }
 */
router.post('/token', async (req, res) => {
  try {
    const { userId, expiresIn = 86400 } = req.body;

    // Validate input
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'userId is required and must be a string'
      });
    }

    // Validate expiresIn
    if (typeof expiresIn !== 'number' || expiresIn < 3600) {
      return res.status(400).json({
        error: 'Invalid expiresIn',
        message: 'expiresIn must be a number >= 3600 seconds'
      });
    }

    // Generate token with expiration
    const expirationTime = Math.floor(Date.now() / 1000) + expiresIn;
    const token = streamChat.createToken(userId, expirationTime);

    const response = {
      token,
      userId,
      expiresAt: new Date(expirationTime * 1000).toISOString(),
      message: 'Token generated successfully'
    };

    console.log(`[Chat] Token generated for user: ${userId}`);
    res.json(response);

  } catch (error) {
    console.error('[Chat] Token generation error:', error);
    res.status(500).json({
      error: 'Failed to generate token',
      message: error.message
    });
  }
});

// ============================================
// USER MANAGEMENT
// ============================================

/**
 * POST /api/chat/user
 * Create or update user in Stream Chat
 * 
 * Request Body:
 * {
 *   "userId": "user123",
 *   "name": "John Doe",
 *   "email": "john@example.com" (optional),
 *   "image": "https://example.com/avatar.jpg" (optional),
 *   "role": "user" (optional)
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "userId": "user123",
 *   "message": "User created/updated successfully"
 * }
 */
router.post('/user', async (req, res) => {
  try {
    const { userId, name, email, image, role = 'user' } = req.body;

    // Validate required fields
    if (!userId || !name) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'userId and name are required'
      });
    }

    // Prepare user data
    const userData = {
      id: userId,
      name: name.trim(),
      role
    };

    // Add optional fields if provided
    if (email && typeof email === 'string') {
      userData.email = email.toLowerCase();
    }
    if (image && typeof image === 'string') {
      userData.image = image;
    }

    // Update/create user in Stream Chat
    const updatedUsers = await streamChat.updateUsers([userData]);

    console.log(`[Chat] User updated: ${userId}`);

    res.json({
      success: true,
      userId,
      name,
      message: 'User created/updated successfully'
    });

  } catch (error) {
    console.error('[Chat] User update error:', error);
    res.status(500).json({
      error: 'Failed to update user',
      message: error.message
    });
  }
});

// ============================================
// CHANNEL MANAGEMENT
// ============================================

/**
 * POST /api/chat/channel
 * Create a new messaging channel
 * 
 * Request Body:
 * {
 *   "channelId": "seller_123_product_456",
 *   "channelName": "Chat About Product",
 *   "members": ["user1", "user2"],
 *   "data": { // optional metadata
 *     "seller_id": "123",
 *     "product_id": "456"
 *   }
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "channelId": "seller_123_product_456",
 *   "message": "Channel created successfully"
 * }
 */
router.post('/channel', async (req, res) => {
  try {
    const { channelId, channelName, members, data } = req.body;

    // Validate input
    if (!channelId || !channelName) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'channelId and channelName are required'
      });
    }

    if (!Array.isArray(members) || members.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'members must be a non-empty array'
      });
    }

    // Create channel
    const channel = streamChat.channel('messaging', channelId, {
      name: channelName.trim(),
      members,
      ...(data && { ...data })
    });

    await channel.create();

    console.log(`[Chat] Channel created: ${channelId} with members: ${members.join(', ')}`);

    res.json({
      success: true,
      channelId,
      channelName,
      memberCount: members.length,
      message: 'Channel created successfully'
    });

  } catch (error) {
    // Handle channel already exists error
    if (error.message.includes('already exists')) {
      console.log(`[Chat] Channel already exists: ${req.body.channelId}`);
      return res.status(409).json({
        success: true,
        message: 'Channel already exists'
      });
    }

    console.error('[Chat] Channel creation error:', error);
    res.status(500).json({
      error: 'Failed to create channel',
      message: error.message
    });
  }
});

/**
 * POST /api/chat/channel/:channelId/add-members
 * Add members to an existing channel
 * 
 * URL Params:
 * - channelId: string
 * 
 * Request Body:
 * {
 *   "members": ["user3", "user4"]
 * }
 */
router.post('/channel/:channelId/add-members', async (req, res) => {
  try {
    const { members } = req.body;
    const { channelId } = req.params;

    if (!Array.isArray(members) || members.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'members must be a non-empty array'
      });
    }

    const channel = streamChat.channel('messaging', channelId);
    await channel.addMembers(members);

    console.log(`[Chat] Added members to channel ${channelId}: ${members.join(', ')}`);

    res.json({
      success: true,
      message: 'Members added successfully',
      memberCount: members.length
    });

  } catch (error) {
    console.error('[Chat] Add members error:', error);
    res.status(500).json({
      error: 'Failed to add members',
      message: error.message
    });
  }
});

// ============================================
// HEALTH CHECK & DEBUG
// ============================================

/**
 * GET /api/chat/health
 * Health check for Stream Chat service
 */
router.get('/health', (req, res) => {
  const apiKeyConfigured = !!process.env.STREAM_CHAT_API_KEY;
  const secretConfigured = !!process.env.STREAM_CHAT_API_SECRET;

  if (!apiKeyConfigured || !secretConfigured) {
    return res.status(500).json({
      status: 'error',
      message: 'Stream Chat not properly configured',
      checks: {
        apiKey: apiKeyConfigured ? '✓' : '✗',
        apiSecret: secretConfigured ? '✓' : '✗'
      }
    });
  }

  res.json({
    status: 'ok',
    message: 'Stream Chat service is configured and running',
    apiKey: 'configured',
    apiSecret: 'configured',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/chat/debug
 * Test Stream Chat connection (development only)
 */
router.get('/debug', async (req, res) => {
  try {
    const testUserId = `test-user-${Date.now()}`;

    // Create test user
    await streamChat.updateUsers([{
      id: testUserId,
      name: 'Test User'
    }]);

    // Generate test token
    const token = streamChat.createToken(testUserId);

    res.json({
      status: 'connected',
      message: 'Stream Chat is working properly',
      test: {
        userId: testUserId,
        tokenLength: token.length,
        tokenPreview: token.substring(0, 50) + '...'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Chat] Debug error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Stream Chat connection failed',
      error: error.message
    });
  }
});

// ============================================
// ERROR HANDLING
// ============================================

// Handle routes that don't exist
router.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} does not exist`
  });
});

module.exports = router;
