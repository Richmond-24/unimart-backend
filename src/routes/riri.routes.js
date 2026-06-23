
const router = require('express').Router();
const { protect, admin } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/riri.controller');

// Public routes
router.get('/suggestions', ctrl.getSuggestions);

// Protected routes (requires user authentication)
router.post('/chat', protect, ctrl.chat);
router.post('/feedback', protect, ctrl.submitFeedback);
router.get('/history', protect, ctrl.getHistory);
router.delete('/history', protect, ctrl.clearHistory);

// Admin routes (requires admin privileges)
router.get('/unanswered-questions', protect, admin, ctrl.getUnansweredQuestions);
router.get('/analytics', protect, admin, ctrl.getAnalytics);

console.log('✅ Riri LLM chat routes registered');

module.exports = router;