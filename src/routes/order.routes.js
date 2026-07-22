
const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth.middleware');

// Simple inline controller functions for testing
const ctrl = {
  getMyOrders: (req, res) => {
    res.json({ success: true, message: 'getMyOrders working', data: [] });
  },
  createOrder: (req, res) => {
    res.status(201).json({ success: true, message: 'createOrder working', data: req.body });
  },
  getOrderById: (req, res) => {
    res.json({ success: true, message: 'getOrderById working', id: req.params.id });
  },
  updateOrderStatus: (req, res) => {
    res.json({ success: true, message: 'updateOrderStatus working', id: req.params.id, status: req.body.status });
  },
  getAllOrders: (req, res) => {
    res.json({ success: true, message: 'getAllOrders working', data: [] });
  },
  deleteOrder: (req, res) => {
    res.json({ success: true, message: 'deleteOrder working', id: req.params.id });
  }
};

console.log('✅ Test controller created with functions:', Object.keys(ctrl));

// All routes require authentication
router.use(protect);

// User routes
router.get('/my-orders', ctrl.getMyOrders);
router.post('/', ctrl.createOrder);
router.get('/:id', ctrl.getOrderById);

// Admin/Seller routes
router.patch('/:id/status', authorize('admin', 'seller'), ctrl.updateOrderStatus);
router.get('/admin/all', authorize('admin'), ctrl.getAllOrders);
router.delete('/:id', authorize('admin'), ctrl.deleteOrder);

console.log('✅ Order routes registered');

module.exports = router;