const express = require('express');
const router = express.Router();
const {
  register,
  login,
  logout,
  getCurrentUser,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
} = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');

/**
 * Public Routes (No Authentication Required)
 */

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 * @body    { firstName, lastName, email, password, passwordConfirm, university?, yearOfStudy? }
 */
router.post('/register', register);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 * @body    { email, password }
 */
router.post('/login', login);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset link
 * @access  Public
 * @body    { email }
 */
router.post('/forgot-password', forgotPassword);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 * @body    { token, newPassword, passwordConfirm }
 */
router.post('/reset-password', resetPassword);

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verify email with token
 * @access  Public
 * @body    { token }
 */
router.post('/verify-email', verifyEmail);

/**
 * Protected Routes (Authentication Required)
 */

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authMiddleware, logout);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authMiddleware, getCurrentUser);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 * @body    { firstName?, lastName?, phone?, bio?, location?, avatar? }
 */
router.put('/profile', authMiddleware, updateProfile);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 * @body    { currentPassword, newPassword, passwordConfirm }
 */
router.post('/change-password', authMiddleware, changePassword);

module.exports = router;
