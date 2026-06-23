const router = require('express').Router();
const ctrl = require('../controllers/listing.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/',       ctrl.getServices);
router.get('/:id',    ctrl.getService);
router.post('/',      protect, ctrl.createService);
router.put('/:id',    protect, ctrl.updateService);
router.delete('/:id', protect, ctrl.deleteService);
module.exports = router;
