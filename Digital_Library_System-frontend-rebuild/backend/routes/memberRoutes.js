const express = require('express');
const router = express.Router();
const memberController = require('../controllers/memberController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

// Get all members
router.get('/', authenticateToken, authorize(['Admin', 'Librarian']), memberController.getAllMembers);

// Get member profile by ID
router.get('/:memberId', authenticateToken, memberController.getMemberById);

// Update member profile
router.put('/:memberId', authenticateToken, memberController.updateMemberProfile);

// Update subscription tier (Admin only)
router.put('/:memberId/subscription', authenticateToken, authorize(['Admin']), memberController.updateSubscriptionTier);

module.exports = router;
