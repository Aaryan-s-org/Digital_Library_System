const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

// List all reports
router.get('/', authenticateToken, authorize(['Admin', 'Librarian']), reportController.getReportsList);

// Generate reading analytics report
router.post('/reading', authenticateToken, authorize(['Admin', 'Librarian']), reportController.generateReadingReport);

// Generate audit summary report
router.post('/audit', authenticateToken, authorize(['Admin']), reportController.generateAuditReport);

// Download a report
router.get('/:reportId/download', authenticateToken, authorize(['Admin', 'Librarian']), reportController.downloadReport);

module.exports = router;
