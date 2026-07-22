
const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const Order = require('../models/Order');

// ============================================
// Get authenticated user's orders
// ============================================
const getMyOrders = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const orders = await Order.find({ buyer: userId })
      .populate('items.product', 'title price images')
      .populate('items.seller', 'name email')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    console.error('Get my orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
};

// ============================================
// Create a new order
// ============================================
const createOrder = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { items, delivery, buyerEmail, totals } = req.body;
    
    console.log('📥 Creating order for user:', userId);
    console.log('📦 Order items:', items);
    console.log('💰 Totals:', totals);
    console.log('📍 Delivery:', delivery);

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Items are required and must be a non-empty array'
      });
    }

    if (!buyerEmail) {
      return res.status(400).json({
        success: false,
        message: 'Buyer email is required'
      });
    }

    // Map frontend items to match your Order model's OrderItemSchema
    const orderItems = items.map(item => {
      // Handle both formats: frontend sends productId, backend expects product
      const productId = item.productId || item.product;
      const sellerId = item.sellerId || item.seller;
      
      return {
        product: productId,
        title: item.name || item.title || 'Product',
        image: item.image || '',
        price: item.price,
        quantity: item.qty || item.quantity || 1,
        seller: sellerId,
      };
    });

    // Calculate totals
    const subtotal = totals?.subtotal || orderItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const deliveryFee = totals?.deliveryFee || 0;
    const total = totals?.total || (subtotal + deliveryFee);

    // Build delivery address from request
    const deliveryAddress = {
      street: delivery?.address?.street || delivery?.address?.city || '',
      city: delivery?.address?.city || '',
      state: delivery?.address?.region || '',
      zip: delivery?.address?.zip || '',
      country: delivery?.address?.country || 'Ghana',
    };

    // Create the order using your existing schema
    const orderData = {
      buyer: userId,
      items: orderItems,
      subtotal: subtotal,
      deliveryFee: deliveryFee,
      total: total,
      deliveryAddress: deliveryAddress,
      paymentMethod: 'paystack',
      paymentStatus: 'pending',
      paymentRef: '',
      status: 'pending',
    };

    console.log('📝 Order data being saved:', JSON.stringify(orderData, null, 2));

    const order = new Order(orderData);
    await order.save();
    
    console.log('✅ Order created successfully:', order._id);

    res.status(201).json({
      success: true,
      id: order._id,
      orderId: order._id,
      status: order.status,
      order: order
    });

  } catch (error) {
    console.error('❌ Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error.message
    });
  }
};

// ============================================
// Get order by ID
// ============================================
const getOrderById = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const orderId = req.params.id;

    const order = await Order.findOne({ 
      _id: orderId,
      $or: [
        { buyer: userId },
        { 'items.seller': userId }
      ]
    })
    .populate('items.product', 'title price images')
    .populate('buyer', 'name email')
    .populate('items.seller', 'name email');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order',
      error: error.message
    });
  }
};

// ============================================
// Update order status
// ============================================
const updateOrderStatus = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const orderId = req.params.id;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const order = await Order.findOne({ 
      _id: orderId,
      $or: [
        { buyer: userId },
        { 'items.seller': userId }
      ]
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // If cancelling, set cancelledAt
    if (status === 'cancelled') {
      order.cancelledAt = new Date();
      order.cancelReason = req.body.reason || 'Cancelled by user';
    }

    // If delivering, set deliveredAt
    if (status === 'delivered') {
      order.deliveredAt = new Date();
    }

    order.status = status;
    await order.save();

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: order
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status',
      error: error.message
    });
  }
};

// ============================================
// Update payment status
// ============================================
const updatePaymentStatus = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { paymentStatus, paymentRef } = req.body;

    if (!paymentStatus) {
      return res.status(400).json({
        success: false,
        message: 'Payment status is required'
      });
    }

    const validStatuses = ['pending', 'paid', 'failed', 'refunded'];
    if (!validStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    order.paymentStatus = paymentStatus;
    if (paymentRef) {
      order.paymentRef = paymentRef;
    }
    await order.save();

    res.json({
      success: true,
      message: 'Payment status updated successfully',
      data: order
    });
  } catch (error) {
    console.error('Update payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update payment status',
      error: error.message
    });
  }
};

// ============================================
// Admin: Get all orders
// ============================================
const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('buyer', 'name email')
      .populate('items.product', 'title price')
      .populate('items.seller', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
};

// ============================================
// Admin: Delete order
// ============================================
const deleteOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findByIdAndDelete(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      message: 'Order deleted successfully',
      data: order
    });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete order',
      error: error.message
    });
  }
};

// ============================================
// ROUTES
// ============================================

// All routes require authentication
router.use(protect);

// User routes
router.get('/my-orders', getMyOrders);
router.post('/', createOrder);
router.get('/:id', getOrderById);
router.patch('/:id/payment', updatePaymentStatus);

// Admin/Seller routes
router.patch('/:id/status', authorize('admin', 'seller'), updateOrderStatus);
router.get('/admin/all', authorize('admin'), getAllOrders);
router.delete('/:id', authorize('admin'), deleteOrder);

console.log('✅ Order routes registered with database support');

module.exports = router;