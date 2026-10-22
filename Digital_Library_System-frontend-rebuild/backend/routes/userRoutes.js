const express = require('express');
const router = express.Router();
const memberController = require('../controllers/memberController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

// Deactivate user (Admin only)
router.post('/:userId/deactivate', authenticateToken, authorize(['Admin']), memberController.deactivateUser);

module.exports = router;
