const express = require('express');
const router = express.Router();
const bookController = require('../controllers/bookController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

// Get all books
router.get('/', bookController.getAllBooks);

// Get book details
router.get('/:bookId', bookController.getBookById);

// Create/Upload book (Librarian & Admin only)
router.post('/', authenticateToken, authorize(['Admin', 'Librarian']), bookController.createBook);

// Update book metadata (Librarian & Admin only)
router.put('/:bookId', authenticateToken, authorize(['Admin', 'Librarian']), bookController.updateBook);

// Delete/Hide book (Admin only)
router.delete('/:bookId', authenticateToken, authorize(['Admin']), bookController.deleteBook);

module.exports = router;
