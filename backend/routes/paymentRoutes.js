const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

// Public Razorpay key config & plans
router.get('/config', paymentController.getConfig);

// Create order for subscription
router.post('/create-order', authenticateToken, paymentController.createOrder);

// Verify payment signature & activate subscription
router.post('/verify', authenticateToken, paymentController.verifyPayment);

// Current user subscription info
router.get('/my-subscription', authenticateToken, paymentController.getUserSubscription);

// Admin & Librarian transaction logs
router.get('/logs', authenticateToken, authorize(['Admin', 'Librarian']), paymentController.getPaymentLogs);

module.exports = router;
