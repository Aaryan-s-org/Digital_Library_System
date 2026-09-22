const express = require('express');
const router = express.Router();
const readerController = require('../controllers/readerController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Get reader info (book metadata + progress + bookmarks)
router.get('/:bookId/info', authenticateToken, readerController.getReaderInfo);

// Stream EPUB file (protected)
router.get('/:bookId/stream', authenticateToken, readerController.streamBook);

module.exports = router;
