const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

// ─── Shared Exports (Admin & Librarian) ──────────────────────
// Books Catalogue
router.post('/books', authenticateToken, authorize(['Admin', 'Librarian']), exportController.exportBooksCatalogue);

// Member Directory
router.post('/members', authenticateToken, authorize(['Admin', 'Librarian']), exportController.exportMemberDirectory);

// Access & Circulation Logs
router.post('/access-logs', authenticateToken, authorize(['Admin', 'Librarian']), exportController.exportAccessLogs);

// Reading Analytics & Circulation
router.post('/reading', authenticateToken, authorize(['Admin', 'Librarian']), exportController.exportReadingAnalytics);

// Payment & Subscription Transactions (Admin & Librarian)
router.post('/payments', authenticateToken, authorize(['Admin', 'Librarian']), exportController.exportPaymentTransactions);

// ─── Admin Only Exports ───────────────────────────────────────
// System Audit Trail Logs
router.post('/audit', authenticateToken, authorize(['Admin']), exportController.exportAuditLogs);

// Search Query History & Trends
router.post('/search-history', authenticateToken, authorize(['Admin']), exportController.exportSearchHistory);

// System Notifications Log
router.post('/notifications', authenticateToken, authorize(['Admin']), exportController.exportNotifications);

// Full System Summary (Executive Report)
router.post('/system-summary', authenticateToken, authorize(['Admin']), exportController.exportSystemSummary);

// ─── Direct File Download ────────────────────────────────────
router.get('/download/:filename', authenticateToken, authorize(['Admin', 'Librarian']), exportController.downloadExportFile);

module.exports = router;
