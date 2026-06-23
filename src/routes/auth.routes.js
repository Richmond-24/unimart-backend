const router = require('express').Router();
const ctrl   = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

router.post('/register',    ctrl.register);
router.post('/check-email', ctrl.checkEmail);
router.post('/login',       ctrl.login);
router.post('/guest-login', ctrl.guestLogin);
router.post('/verify',      ctrl.verifyEmail);
router.post('/resend-verification', ctrl.resendVerification);
router.post('/logout',      protect, ctrl.logout);
router.get('/me',           protect, ctrl.getCurrentUser);
router.put('/profile',      protect, ctrl.updateProfile);
router.post('/change-password', protect, ctrl.changePassword);

module.exports = router;
