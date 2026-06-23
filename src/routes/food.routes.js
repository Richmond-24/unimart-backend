const router = require('express').Router();
const ctrl = require('../controllers/listing.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/',       ctrl.getFoods);
router.get('/:id',    ctrl.getFood);
router.post('/',      protect, ctrl.createFood);
router.put('/:id',    protect, ctrl.updateFood);
router.delete('/:id', protect, ctrl.deleteFood);
module.exports = router;
