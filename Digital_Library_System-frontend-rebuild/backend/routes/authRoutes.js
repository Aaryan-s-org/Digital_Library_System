const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

// Public Route
router.post('/login', authController.login);

// Protected Route (Admin only)
router.post('/register', authenticateToken, authorize(['Admin']), authController.register);

module.exports = router;
