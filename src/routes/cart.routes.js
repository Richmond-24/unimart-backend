const router = require('express').Router();
const ctrl = require('../controllers/cart.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);
router.get('/',                 ctrl.getCart);
router.post('/add',             ctrl.addToCart);
router.put('/update',           ctrl.updateCartItem);
router.delete('/clear',         ctrl.clearCart);
router.delete('/:productId',    ctrl.removeFromCart);
module.exports = router;
