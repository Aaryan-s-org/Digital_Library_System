const express = require('express');
const router = express.Router();
const progressController = require('../controllers/progressController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Get all reading progress for current user
router.get('/', authenticateToken, progressController.getAllProgress);

// Get progress for a specific book
router.get('/:bookId', authenticateToken, progressController.getProgress);

// Update progress for a specific book
router.put('/:bookId', authenticateToken, progressController.updateProgress);

module.exports = router;
