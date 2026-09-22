const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

// Get audit logs (Admin only)
router.get('/', authenticateToken, authorize(['Admin']), auditController.getAuditLogs);

// Get audit statistics (Admin only)
router.get('/stats', authenticateToken, authorize(['Admin']), auditController.getAuditStats);

// Get dashboard stats (Admin and Librarian)
router.get('/dashboard', authenticateToken, authorize(['Admin', 'Librarian']), auditController.getDashboardStats);

module.exports = router;
