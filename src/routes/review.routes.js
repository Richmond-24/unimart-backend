const router = require('express').Router();
const ctrl = require('../controllers/extras.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/',       ctrl.getReviews);
router.post('/',      protect, ctrl.createReview);
router.delete('/:id', protect, ctrl.deleteReview);
module.exports = router;
