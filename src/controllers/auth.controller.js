const axios = require('axios');
const User = require('../models/User.model');
const Seller = require('../models/Seller.model');
const VerificationToken = require('../models/VerificationToken');
const crypto = require('crypto');
const { sendWelcomeEmail } = require('../utils/emailService');

const normalizeUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  return url.trim().replace(/\/+$|\s+/g, '');
};

const notifyZapierSignup = async (user) => {
  const zapierUrl = normalizeUrl(process.env.ZAPIER_WEBHOOK_URL);
  if (!zapierUrl) {
    console.log('No ZAPIER_WEBHOOK_URL configured; skipping Zapier signup notification');
    return;
  }

  const names = (user.name || '').trim().split(/\s+/);
  const firstName = names[0] || '';
  const lastName = names.length > 1 ? names.slice(1).join(' ') : '';
  const payload = {
    id: String(user._id),
    email: user.email,
    name: user.name || '',
    firstName,
    lastName,
    role: user.role || 'buyer',
    signupAt: new Date().toISOString(),
    // Tell the Zapier Zap to send the welcome email
    welcomeEmailRequired: true,
    university: user.university || '',
  };

  console.log(`📨 Sending Zapier signup webhook for ${user.email}...`);
  const response = await axios.post(zapierUrl, payload, {
    timeout: 7000,
    headers: { 'Content-Type': 'application/json' },
  });

  console.log(`✅ Zapier signup webhook sent for ${user.email}: ${response.status}`);
  return response.data;
};

// Helper: send token response
const sendToken = (user, statusCode, res) => {
  const token = user.getSignedJwt();
  res.status(statusCode).json({
    success: true,
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      university: user.university,
      studentId: user.studentId,
      department: user.department,
      role: user.role,
      isVerified: user.isVerified,
    },
  });
};

// @desc  Register
// @route POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const rawName = req.body.name || '';
    const rawFullName = req.body.fullName || req.body.full_name || '';
    const rawFirstName = req.body.firstName || req.body.first_name || '';
    const rawLastName = req.body.lastName || req.body.last_name || '';
    const rawEmail = req.body.email || req.body.emailAddress || '';
    const rawPassword = req.body.password || '';
    const rawPasswordConfirm = req.body.passwordConfirm || req.body.password_confirmation || '';
    const rawPhoneNumber = req.body.phoneNumber || req.body.phone_number || '';

    const computedName = `${rawFirstName || ''} ${rawLastName || ''}`.trim();
    const name = String(rawName || rawFullName || computedName || '').trim();
    const email = String(rawEmail).toLowerCase().trim();
    const password = String(rawPassword);
    const passwordConfirm = String(rawPasswordConfirm);
    const phone = req.body.phone || rawPhoneNumber || '';
    const university = req.body.university || '';
    const studentId = req.body.studentId || req.body.student_id || '';
    const department = req.body.department || '';
    const avatar = req.body.avatar || '';
    const location = req.body.location || '';
    const locationCoords = req.body.locationCoords || {};
    const role = req.body.role === 'seller' ? 'seller' : 'buyer';
    const shopName = req.body.shopName || req.body.shop_name || '';
    const shopBio = req.body.shopBio || req.body.shop_bio || '';

    console.log('📝 Registration request received:', {
      name: name ? name.substring(0, 30) : null,
      email: email ? '***' + email.slice(-10) : null,
      university,
      role,
      hasPassword: !!password,
      location: location ? String(location).substring(0, 100) : null,
    });

    // Validate required fields
    if (!name || !email || !password) {
      console.log('❌ Missing required fields:', { name: !!name, email: !!email, password: !!password });
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required'
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
    }

    if (passwordConfirm && password !== passwordConfirm) {
      return res.status(400).json({ success: false, message: 'Password confirmation does not match.' });
    }

    if (password.length > 128) {
      return res.status(400).json({ success: false, message: 'Password is too long.' });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('❌ Email already exists:', email);
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Normalize and create new user
    const user = await User.create({
      name,
      email,
      password,
      phone: String(phone).trim(),
      university: String(university).trim(),
      studentId: String(studentId).trim(),
      department: String(department).trim(),
      avatar: String(avatar).trim(),
      location: String(location).trim(),
      locationCoords: {
        lat: typeof locationCoords?.lat === 'number' ? locationCoords.lat : null,
        lon: typeof locationCoords?.lon === 'number' ? locationCoords.lon : null,
      },
      role
    });

    console.log('✅ User created successfully:', { _id: user._id, email: user.email });

    // Mark the account as verified and send a welcome email without blocking signup.
    try {
      user.isVerified = true;
      await user.save();
      console.log('✅ User marked verified successfully');
    } catch (verifyErr) {
      console.error('❌ Failed to mark user verified:', verifyErr);
    }

    const firstName = (user.name || '').split(' ')[0] || '';
    try {
      setImmediate(async () => {
        // Fire Zapier webhook FIRST — it's the primary welcome-email trigger
        try {
          await notifyZapierSignup(user);
        } catch (zapErr) {
          console.warn('⚠️ Zapier signup webhook failed:', zapErr?.message || zapErr);
        }

        // SMTP welcome email as fallback (may fail if Gmail App Password is expired)
        try {
          const sent = await sendWelcomeEmail(user.email, firstName);
          console.log(`📧 Welcome email ${sent ? 'sent' : 'skipped (no SMTP)'} for user: ${user.email}`);
        } catch (emailErr) {
          console.error('❌ Failed to send welcome email via SMTP:', emailErr?.message || emailErr);
        }
      });
    } catch (e) {
      console.error('❌ Error scheduling signup notifications:', e);
    }

    // Auto-create seller profile if role is seller
    if (user.role === 'seller') {
      try {
        await Seller.create({
          user: user._id,
          shopName: shopName && shopName.trim() ? shopName.trim() : name,
          bio: shopBio || '',
          university: university || '',
          department: department || ''
        });
        console.log('✅ Seller profile created:', { userId: user._id, shopName: shopName || name });
      } catch (sellerErr) {
        console.error('❌ Failed to create seller profile:', sellerErr);
      }
    }

    sendToken(user, 201, res);
  } catch (err) {
    console.error('❌ Registration error:', {
      message: err.message,
      code: err.code,
      errors: err.errors,
    });
    next(err);
  }
};

// @desc  Verify email
// @route POST /api/auth/verify
exports.verifyEmail = async (req, res, next) => {
  try {
    const token = req.body.token || req.query.token;
    if (!token) return res.status(400).json({ success: false, message: 'Token is required' });

    const vt = await VerificationToken.findOne({ token });
    if (!vt) return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    if (vt.expiresAt < new Date()) {
      await VerificationToken.deleteMany({ user: vt.user }).catch(() => { });
      return res.status(400).json({ success: false, message: 'Token has expired' });
    }

    const user = await User.findById(vt.user);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.isVerified = true;
    await user.save();

    // remove tokens for this user
    await VerificationToken.deleteMany({ user: user._id }).catch(() => { });

    // SMTP disabled for verification completion.
    console.log('✅ Email verification completed without SMTP send for', user.email);

    res.json({ success: true, message: 'Email verified' });
  } catch (err) { console.error('❌ verifyEmail error:', err); next(err); }
};

// @desc  Resend verification token
// @route POST /api/auth/resend-verification
exports.resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ success: false, message: 'No account found with that email' });
    if (user.isVerified) return res.status(400).json({ success: false, message: 'Account already verified' });

    // Delete old tokens
    await VerificationToken.deleteMany({ user: user._id }).catch(() => { });

    // Create and send new token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await VerificationToken.create({ user: user._id, token, expiresAt });

    const appUrl = process.env.APP_URL ? process.env.APP_URL.replace(/\/$/, '') : `http://localhost:${process.env.PORT || 5000}`;
    const verificationLink = `${appUrl}/api/auth/verify?token=${encodeURIComponent(token)}`;
    const firstName = (user.name || '').split(' ')[0] || '';

    console.log(`✅ Resend verification requested for ${user.email}, SMTP disabled`);

    res.json({ success: true, message: 'Verification email sending is disabled in this deployment.' });
  } catch (err) { console.error('❌ resendVerification error:', err); next(err); }
};

// @desc  Login
// @route POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    console.log('📝 Login request received:', { email: email?.substring(0, 5) + '***', hasPassword: !!password });

    // Validate email format
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      console.log('❌ Invalid email format');
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address'
      });
    }

    // Validate password is provided and has minimum length
    if (!password || typeof password !== 'string') {
      console.log('❌ Missing password');
      return res.status(400).json({
        success: false,
        message: 'Please enter your password'
      });
    }

    if (password.length < 6) {
      console.log('❌ Password too short');
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Find user and include password
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    // Check if user exists
    if (!user) {
      console.log('❌ Login failed for email:', email);
      return res.status(401).json({
        success: false,
        message: 'Email or password is incorrect. Please check and try again.'
      });
    }

    // Check password match
    let passwordMatch = false;
    try {
      passwordMatch = await user.matchPassword(password);
    } catch (pwErr) {
      console.error('❌ Password comparison error:', pwErr.message);
      return res.status(500).json({
        success: false,
        message: 'Authentication service error. Please try again.'
      });
    }

    if (!passwordMatch) {
      console.log('❌ Login failed for email:', email);
      return res.status(401).json({
        success: false,
        message: 'Email or password is incorrect. Please check and try again.'
      });
    }

    // Check if account is banned
    if (user.isBanned) {
      console.log('❌ User account banned:', email);
      return res.status(403).json({
        success: false,
        message: 'This account has been suspended. Contact support for assistance.'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      console.log('❌ User account inactive:', email);
      return res.status(403).json({
        success: false,
        message: 'This account is not active. Please contact support.'
      });
    }

    // Update last login
    try {
      user.lastLogin = new Date();
      await user.save();
    } catch (updateErr) {
      console.warn('⚠️ Failed to update lastLogin:', updateErr.message);
      // Don't fail login if we can't update lastLogin
    }

    console.log('✅ Login successful for:', email);
    sendToken(user, 200, res);
  } catch (err) {
    console.error('❌ Login error:', {
      message: err.message,
      code: err.code,
      stack: err.stack
    });
    next(err);
  }
};

// @desc  Check if email is available
// @route POST /api/auth/check-email
exports.checkEmail = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email required' });
    const exists = await User.findOne({ email });
    res.json({ success: true, emailExists: !!exists, available: !exists });
  } catch (err) { next(err); }
};

// @desc  Get current user
// @route GET /api/auth/me
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate('savedItems', 'title price images');
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

// @desc  Update password
// @route PUT /api/auth/password
exports.updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    if (!(await user.matchPassword(currentPassword)))
      return res.status(401).json({ success: false, message: 'Incorrect current password' });

    user.password = newPassword;
    await user.save();
    sendToken(user, 200, res);
  } catch (err) { next(err); }
};

// @desc  Save push notification token
// @route PUT /api/auth/push-token
exports.savePushToken = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { pushToken: req.body.token });
    res.json({ success: true, message: 'Push token saved' });
  } catch (err) { next(err); }
};

// Minimal guest login: create a guest user and return token
exports.guestLogin = async (req, res, next) => {
  try {
    const guestId = `guest_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const guestUser = await User.create({
      name: 'Guest User',
      email: `${guestId}@guest.local`,
      password: crypto.randomBytes(16).toString('hex'),
      guestId,
      isGuest: true,
      role: 'guest',
      isActive: true,
    });
    sendToken(guestUser, 200, res);
  } catch (err) { next(err); }
};

// Logout: update lastActivity and respond
exports.logout = async (req, res, next) => {
  try {
    if (req.user) {
      await User.findByIdAndUpdate(req.user._id, { lastActivity: new Date() });
    }
    res.json({ success: true, message: 'Logged out' });
  } catch (err) { next(err); }
};

// Update profile (partial)
exports.updateProfile = async (req, res, next) => {
  try {
    const updates = {};
    const allowed = ['name', 'phone', 'avatar', 'university', 'studentId', 'department', 'bio'];
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

// Change password (wrapper around updatePassword)
exports.changePassword = async (req, res, next) => {
  try {
    // reuse updatePassword implementation
    return exports.updatePassword(req, res, next);
  } catch (err) { next(err); }
};

// Backwards-compatible aliases
exports.getCurrentUser = exports.getMe;
