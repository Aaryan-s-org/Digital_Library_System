const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

// Get notifications for current user
router.get('/', authenticateToken, notificationController.getNotifications);

// Mark a notification as read
router.put('/:notificationId/read', authenticateToken, notificationController.markAsRead);

// Mark all notifications as read
router.put('/read-all', authenticateToken, notificationController.markAllAsRead);

// Create notification (Admin/Librarian)
router.post('/', authenticateToken, authorize(['Admin', 'Librarian']), notificationController.createNotification);

// Broadcast notification (Admin only)
router.post('/broadcast', authenticateToken, authorize(['Admin']), notificationController.broadcastNotification);

module.exports = router;
