const express = require('express');
const router = express.Router();
const bookmarkController = require('../controllers/bookmarkController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Get all bookmarks for current user
router.get('/', authenticateToken, bookmarkController.getAllBookmarks);

// Get bookmarks for a specific book
router.get('/book/:bookId', authenticateToken, bookmarkController.getBookmarks);

// Create a bookmark for a book
router.post('/book/:bookId', authenticateToken, bookmarkController.createBookmark);

// Update a bookmark
router.put('/:bookmarkId', authenticateToken, bookmarkController.updateBookmark);

// Delete a bookmark
router.delete('/:bookmarkId', authenticateToken, bookmarkController.deleteBookmark);

module.exports = router;
