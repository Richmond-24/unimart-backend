
// /home/richmond/Downloads/Uni-Mart/unimart-backend/src/routes/product.routes.js

const router = require('express').Router();
const ctrl = require('../controllers/product.controller');
const { protect, admin } = require('../middleware/auth.middleware');

// DEBUG: Check which functions are defined
console.log('🔍 Product controller exports:', Object.keys(ctrl));

// Since your controller only has approveProduct and rejectProduct,
// we'll only define routes for these functions

// ✅ APPROVE route
router.put('/:id/approve', protect, admin, ctrl.approveProduct);

// ❌ REJECT route
router.put('/:id/reject', protect, admin, ctrl.rejectProduct);

// Seller CRUD
router.post('/', protect, ctrl.createProduct);
router.get('/mine', protect, ctrl.getMyProducts);
router.put('/:id', protect, ctrl.updateProduct);
router.delete('/:id', protect, ctrl.deleteProduct);

// Add a simple test route to verify the router is working
router.get('/test', (req, res) => {
  res.json({ message: 'Product routes are working!' });
});

module.exports = router;