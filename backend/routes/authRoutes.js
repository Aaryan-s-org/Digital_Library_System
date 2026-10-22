const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

// Public Routes
router.post('/login', authController.login);
router.post('/signup', authController.signup);

// Protected Routes
router.get('/me', authenticateToken, authController.me);
router.put('/update-email', authenticateToken, authController.updateEmail);
router.post('/register', authenticateToken, authorize(['Admin']), authController.register);

module.exports = router;
