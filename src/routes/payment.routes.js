// src/routes/payment.routes.js
const router = require('express').Router();
const axios = require('axios');
const Order = require('../models/Order');
const { protect } = require('../middleware/auth.middleware');

// ============================================
// Initialize Paystack Payment
// ============================================
const initializePaystackPayment = async (req, res) => {
  try {
    const { email, amount, orderId, splitCode } = req.body;
    
    // Validate required fields
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid amount is required'
      });
    }
    
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }

    // Get Paystack secret key from environment
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      console.error('❌ PAYSTACK_SECRET_KEY not configured');
      return res.status(500).json({
        success: false,
        message: 'Payment service is not configured. Please contact support.'
      });
    }

    // Get frontend URL for callback
    const frontendUrl = process.env.FRONTEND_URL || 'https://unimartapp-phi.vercel.app';
    const callbackUrl = `${frontendUrl}/checkout/success`;

    console.log('💳 Initializing Paystack payment:');
    console.log(`  - Email: ${email}`);
    console.log(`  - Amount: GHS ${amount}`);
    console.log(`  - Order ID: ${orderId}`);
    console.log(`  - Split Code: ${splitCode || 'None'}`);
    console.log(`  - Callback: ${callbackUrl}`);

    // Prepare Paystack request
    const paystackPayload = {
      email: email.trim().toLowerCase(),
      amount: Math.round(amount * 100), // Convert to pesewas/kobo (GHS * 100)
      reference: `order_${orderId}_${Date.now()}`,
      metadata: {
        orderId: orderId,
        split_code: splitCode || null,
      },
      callback_url: callbackUrl,
    };

    // Add split code if provided
    if (splitCode) {
      paystackPayload.split_code = splitCode;
    }

    // Make request to Paystack
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      paystackPayload,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000, // 10 second timeout
      }
    );

    // Check Paystack response
    if (response.data && response.data.status) {
      console.log('✅ Payment initialized successfully');
      console.log(`  - Reference: ${response.data.data.reference}`);
      console.log(`  - Access Code: ${response.data.data.access_code}`);

      // Store payment reference in order
      try {
        await Order.findByIdAndUpdate(orderId, {
          paymentRef: response.data.data.reference,
          paymentStatus: 'pending',
        });
        console.log(`✅ Order ${orderId} updated with payment reference`);
      } catch (err) {
        console.warn('⚠️ Could not update order with payment reference:', err.message);
        // Non-critical, continue
      }

      return res.json({
        success: true,
        access_code: response.data.data.access_code,
        reference: response.data.data.reference,
      });
    } else {
      console.error('❌ Paystack initialization failed:', response.data?.message);
      return res.status(400).json({
        success: false,
        message: response.data?.message || 'Payment initialization failed. Please try again.'
      });
    }

  } catch (error) {
    console.error('❌ Paystack initialize error:');
    
    if (error.response) {
      // The request was made and the server responded with a status code
      console.error('  - Status:', error.response.status);
      console.error('  - Data:', JSON.stringify(error.response.data, null, 2));
      
      return res.status(error.response.status || 500).json({
        success: false,
        message: error.response.data?.message || 'Payment service error. Please try again.',
        error: error.response.data,
      });
    } else if (error.request) {
      // The request was made but no response was received
      console.error('  - No response received from Paystack');
      return res.status(503).json({
        success: false,
        message: 'Payment service is currently unavailable. Please try again later.'
      });
    } else {
      // Something happened in setting up the request
      console.error('  - Request setup error:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to initialize payment. Please try again.',
        error: error.message,
      });
    }
  }
};

// ============================================
// Verify Paystack Payment
// ============================================
const verifyPaystackPayment = async (req, res) => {
  try {
    const { reference, orderId } = req.body;
    
    if (!reference) {
      return res.status(400).json({
        success: false,
        message: 'Payment reference is required'
      });
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      console.error('❌ PAYSTACK_SECRET_KEY not configured');
      return res.status(500).json({
        success: false,
        message: 'Payment service is not configured. Please contact support.'
      });
    }

    console.log('🔍 Verifying Paystack payment:');
    console.log(`  - Reference: ${reference}`);
    console.log(`  - Order ID: ${orderId || 'Not provided'}`);

    // Verify payment with Paystack
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    // Check verification result
    if (response.data && response.data.status) {
      const transaction = response.data.data;
      
      console.log('✅ Payment verification successful:');
      console.log(`  - Status: ${transaction.status}`);
      console.log(`  - Amount: GHS ${transaction.amount / 100}`);
      console.log(`  - Reference: ${transaction.reference}`);

      // Update order if payment was successful
      if (transaction.status === 'success') {
        try {
          // Try to find order by ID or reference
          let order = null;
          
          if (orderId) {
            order = await Order.findById(orderId);
          }
          
          if (!order) {
            // Try to find by payment reference
            order = await Order.findOne({ paymentRef: reference });
          }

          if (order) {
            order.paymentStatus = 'paid';
            order.paymentRef = reference;
            order.status = 'confirmed';
            order.updatedAt = new Date();
            await order.save();
            
            console.log(`✅ Order ${order._id} updated to paid status`);
          } else {
            console.warn(`⚠️ Order not found for reference: ${reference}`);
            // Non-critical, but log it
          }
        } catch (err) {
          console.warn('⚠️ Could not update order:', err.message);
          // Non-critical, continue
        }

        return res.json({
          success: true,
          status: 'success',
          data: transaction,
          message: 'Payment verified successfully'
        });
      } else {
        // Payment was not successful
        console.log(`⚠️ Payment status: ${transaction.status}`);
        
        // Update order status if possible
        if (orderId) {
          try {
            await Order.findByIdAndUpdate(orderId, {
              paymentStatus: transaction.status === 'failed' ? 'failed' : 'pending',
            });
          } catch (err) {
            // Ignore
          }
        }

        return res.json({
          success: false,
          status: transaction.status,
          message: `Payment ${transaction.status}. Please try again.`,
          data: transaction
        });
      }
    } else {
      console.error('❌ Paystack verification failed:', response.data?.message);
      return res.status(400).json({
        success: false,
        message: response.data?.message || 'Payment verification failed. Please contact support.'
      });
    }

  } catch (error) {
    console.error('❌ Paystack verify error:');
    
    if (error.response) {
      console.error('  - Status:', error.response.status);
      console.error('  - Data:', JSON.stringify(error.response.data, null, 2));
      
      return res.status(error.response.status || 500).json({
        success: false,
        message: error.response.data?.message || 'Payment verification failed. Please contact support.',
        error: error.response.data,
      });
    } else if (error.request) {
      console.error('  - No response received from Paystack');
      return res.status(503).json({
        success: false,
        message: 'Payment service is currently unavailable. Please try again later.'
      });
    } else {
      console.error('  - Request setup error:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to verify payment. Please contact support.',
        error: error.message,
      });
    }
  }
};

// ============================================
// Get Payment Status
// ============================================
const getPaymentStatus = async (req, res) => {
  try {
    const { reference } = req.params;
    
    if (!reference) {
      return res.status(400).json({
        success: false,
        message: 'Payment reference is required'
      });
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      return res.status(500).json({
        success: false,
        message: 'Payment service is not configured.'
      });
    }

    // Query Paystack for transaction status
    const response = await axios.get(
      `https://api.paystack.co/transaction/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    if (response.data && response.data.status) {
      return res.json({
        success: true,
        data: response.data.data,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: response.data?.message || 'Could not fetch payment status'
      });
    }

  } catch (error) {
    console.error('❌ Get payment status error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get payment status',
      error: error.message,
    });
  }
};

// ============================================
// Webhook for Paystack (Handle callbacks)
// ============================================
const paystackWebhook = async (req, res) => {
  try {
    // Verify webhook signature (optional but recommended)
    const signature = req.headers['x-paystack-signature'];
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    
    // In production, verify the webhook signature
    // For now, just log and process
    console.log('📨 Paystack webhook received:');
    console.log('  - Body:', JSON.stringify(req.body, null, 2));

    const event = req.body;
    const data = event.data;

    // Handle different events
    if (event.event === 'charge.success') {
      console.log('✅ Payment successful via webhook:');
      console.log(`  - Reference: ${data.reference}`);
      console.log(`  - Amount: GHS ${data.amount / 100}`);

      // Find and update order
      try {
        const order = await Order.findOne({ paymentRef: data.reference });
        if (order) {
          order.paymentStatus = 'paid';
          order.status = 'confirmed';
          order.updatedAt = new Date();
          await order.save();
          console.log(`✅ Order ${order._id} updated via webhook`);
        } else {
          console.warn(`⚠️ Order not found for reference: ${data.reference}`);
        }
      } catch (err) {
        console.error('❌ Webhook order update failed:', err.message);
      }
    }

    // Always respond with 200 to acknowledge receipt
    res.status(200).json({ success: true });

  } catch (error) {
    console.error('❌ Webhook error:', error.message);
    // Still return 200 to prevent Paystack from retrying
    res.status(200).json({ success: true, error: error.message });
  }
};

// ============================================
// ROUTES
// ============================================

// Public webhook endpoint (no auth required)
router.post('/webhook', paystackWebhook);

// Protected routes (require authentication)
router.use(protect);

// Payment initialization
router.post('/paystack/initialize', initializePaystackPayment);

// Payment verification
router.post('/paystack/verify', verifyPaystackPayment);

// Get payment status
router.get('/paystack/status/:reference', getPaymentStatus);

console.log('✅ Payment routes registered');

module.exports = router;