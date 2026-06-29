const router = require('express').Router();
const ctrl   = require('../controllers/auth.controller');
const { authRateLimitMiddleware } = require('../middleware/auth');
const { protect } = require('../middleware/auth.middleware');

router.post('/register',    authRateLimitMiddleware, ctrl.register);
router.post('/check-email', authRateLimitMiddleware, ctrl.checkEmail);
router.post('/login',       authRateLimitMiddleware, ctrl.login);
router.post('/guest-login', authRateLimitMiddleware, ctrl.guestLogin);
router.post('/verify',      authRateLimitMiddleware, ctrl.verifyEmail);
router.post('/resend-verification', authRateLimitMiddleware, ctrl.resendVerification);
router.post('/logout',      protect, ctrl.logout);
router.get('/me',           protect, ctrl.getCurrentUser);
router.put('/profile',      protect, ctrl.updateProfile);
router.post('/change-password', protect, ctrl.changePassword);

module.exports = router;
