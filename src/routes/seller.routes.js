const router = require('express').Router();
const ctrl = require('../controllers/listing.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/',       ctrl.getSellers);
router.get('/me',     protect, ctrl.getSellerMe);
router.get('/:id',    ctrl.getSeller);
router.put('/me',     protect, ctrl.updateSellerProfile);
module.exports = router;
