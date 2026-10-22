const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

// Get all categories
router.get('/', categoryController.getAllCategories);

// Create category (Admin only)
router.post('/', authenticateToken, authorize(['Admin']), categoryController.createCategory);

module.exports = router;
