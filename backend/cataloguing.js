// Cataloguing Module - Team 1
// Comprehensive book management system

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Configure file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './secure_ebooks';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${uuidv4()}${ext}`;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|epub/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF and EPUB files are allowed'));
    }
  }
});

// ===========================
// Cataloguing Routes
// ===========================

// FR4: Get all books with advanced filtering & search
router.get('/books', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      category, 
      search,
      sortBy = 'UploadDate',
      sortOrder = 'DESC',
      format,
      authorSearch,
      isbnSearch,
      yearFrom,
      yearTo
    } = req.query;

    const offset = (page - 1) * limit;
    let query = `
      SELECT 
        b.BookID, 
        b.Title, 
        b.Author, 
        b.ISBN, 
        b.Publisher,
        b.PublishedDate,
        b.Description,
        b.Format, 
        b.FileSizeMB,
        b.CoverImagePath,
        b.IsAvailable,
        b.UploadDate,
        b.ViewCount,
        b.DownloadCount,
        b.AverageRating,
        c.GenreName,
        c.CategoryID,
        u.Username as UploadedBy
      FROM ebooks b
      LEFT JOIN categories c ON b.CategoryID = c.CategoryID
      LEFT JOIN users u ON b.UploadedBy = u.UserID
      WHERE b.IsAvailable = 1
    `;
    
    let params = [];

    // Filters
    if (category) {
      query += ` AND c.CategoryID = ?`;
      params.push(category);
    }

    if (search) {
      query += ` AND (b.Title LIKE ? OR b.Publisher LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    if (authorSearch) {
      query += ` AND b.Author LIKE ?`;
      params.push(`%${authorSearch}%`);
    }

    if (isbnSearch) {
      query += ` AND b.ISBN = ?`;
      params.push(isbnSearch);
    }

    if (format) {
      query += ` AND b.Format = ?`;
      params.push(format.toUpperCase());
    }

    if (yearFrom) {
      query += ` AND YEAR(b.PublishedDate) >= ?`;
      params.push(yearFrom);
    }

    if (yearTo) {
      query += ` AND YEAR(b.PublishedDate) <= ?`;
      params.push(yearTo);
    }

    // Sorting
    const allowedSortBy = ['UploadDate', 'Title', 'Author', 'ViewCount', 'DownloadCount', 'AverageRating'];
    const sortByField = allowedSortBy.includes(sortBy) ? sortBy : 'UploadDate';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    query += ` ORDER BY b.${sortByField} ${order}`;
    query += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const connection = await pool.getConnection();
    const [books] = await connection.query(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM ebooks b
                      LEFT JOIN categories c ON b.CategoryID = c.CategoryID
                      WHERE b.IsAvailable = 1`;
    let countParams = [];

    if (category) {
      countQuery += ` AND c.CategoryID = ?`;
      countParams.push(category);
    }
    if (search) {
      countQuery += ` AND (b.Title LIKE ? OR b.Publisher LIKE ?)`;
      countParams.push(`%${search}%`, `%${search}%`);
    }

    const [countResult] = await connection.query(countQuery, countParams);
    connection.release();

    res.json({
      success: true,
      data: books,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / limit)
      },
      filters: {
        sortBy: sortByField,
        sortOrder: order
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching books',
      error: error.message
    });
  }
});

// Get book details with full metadata
router.get('/books/:bookId', async (req, res) => {
  try {
    const { bookId } = req.params;

    const connection = await pool.getConnection();
    
    // Get book details
    const [books] = await connection.query(
      `SELECT 
        b.*,
        c.GenreName,
        u.Username as UploadedByName,
        u.Email as UploaderEmail,
        COUNT(DISTINCT al.LogID) as SessionCount,
        SUM(al.SessionDuration) as TotalReadTime
      FROM ebooks b
      LEFT JOIN categories c ON b.CategoryID = c.CategoryID
      LEFT JOIN users u ON b.UploadedBy = u.UserID
      LEFT JOIN accesslogs al ON b.BookID = al.BookID
      WHERE b.BookID = ?
      GROUP BY b.BookID`,
      [bookId]
    );

    if (!books.length) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }

    const book = books[0];

    // Get similar books in same category
    const [similarBooks] = await connection.query(
      `SELECT BookID, Title, Author, ISBN, CoverImagePath
       FROM ebooks
       WHERE CategoryID = ? AND BookID != ? AND IsAvailable = 1
       LIMIT 5`,
      [book.CategoryID, bookId]
    );

    // Increment view count
    await connection.query(
      'UPDATE ebooks SET ViewCount = ViewCount + 1 WHERE BookID = ?',
      [bookId]
    );

    connection.release();

    await logAuditAction(req.user?.userId, 'VIEW', 'EBooks', bookId, {}, req.ip, 200);

    res.json({
      success: true,
      data: {
        book,
        similarBooks,
        stats: {
          sessions: book.SessionCount || 0,
          totalReadTime: book.TotalReadTime || 0
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching book',
      error: error.message
    });
  }
});

// FR4: Upload new book (Librarian & Admin)
router.post('/books', authenticateToken, authorize(['Admin', 'Librarian']), upload.single('file'), async (req, res) => {
  try {
    const {
      title,
      author,
      isbn,
      categoryId,
      publisher,
      publishedDate,
      description,
      format
    } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    if (!title || !author || !isbn || !categoryId) {
      // Delete uploaded file if validation fails
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: title, author, isbn, categoryId'
      });
    }

    const fileSizeMB = (req.file.size / (1024 * 1024)).toFixed(2);
    const fileFormat = format || req.file.mimetype.includes('pdf') ? 'PDF' : 'EPUB';

    const connection = await pool.getConnection();

    try {
      const [result] = await connection.query(
        `INSERT INTO ebooks (
          CategoryID, Title, Author, ISBN, Publisher, PublishedDate,
          Description, Format, FilePath, FileSizeMB, UploadedBy, IsAvailable, TotalCopies, AvailableCopies
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 1)`,
        [
          categoryId,
          title,
          author,
          isbn,
          publisher || null,
          publishedDate || null,
          description || null,
          fileFormat,
          req.file.path,
          fileSizeMB,
          req.user.userId
        ]
      );

      connection.release();

      const bookId = result.insertId;

      await logAuditAction(req.user.userId, 'CREATE', 'EBooks', bookId, {
        title,
        author,
        isbn,
        fileSize: fileSizeMB
      }, req.ip, 201);

      res.status(201).json({
        success: true,
        message: 'Book uploaded successfully',
        bookId,
        file: {
          name: req.file.originalname,
          size: fileSizeMB,
          format: fileFormat
        }
      });
    } catch (error) {
      connection.release();
      // Delete file on database error
      fs.unlinkSync(req.file.path);
      throw error;
    }
  } catch (error) {
    console.error('Book upload error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'ISBN already exists in catalog'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error uploading book',
      error: error.message
    });
  }
});

// FR4: Update book metadata
router.put('/books/:bookId', authenticateToken, authorize(['Admin', 'Librarian']), async (req, res) => {
  try {
    const { bookId } = req.params;
    const {
      title,
      author,
      publisher,
      description,
      categoryId,
      publishedDate,
      totalCopies,
      availableCopies
    } = req.body;

    const connection = await pool.getConnection();

    try {
      // Get current book for audit log
      const [currentBook] = await connection.query(
        'SELECT * FROM ebooks WHERE BookID = ?',
        [bookId]
      );

      if (!currentBook.length) {
        connection.release();
        return res.status(404).json({
          success: false,
          message: 'Book not found'
        });
      }

      // Update book
      await connection.query(
        `UPDATE ebooks
         SET Title = COALESCE(?, Title),
             Author = COALESCE(?, Author),
             Publisher = COALESCE(?, Publisher),
             Description = COALESCE(?, Description),
             CategoryID = COALESCE(?, CategoryID),
             PublishedDate = COALESCE(?, PublishedDate),
             TotalCopies = COALESCE(?, TotalCopies),
             AvailableCopies = COALESCE(?, AvailableCopies),
             LastUpdated = CURRENT_TIMESTAMP
         WHERE BookID = ?`,
        [title, author, publisher, description, categoryId, publishedDate, totalCopies, availableCopies, bookId]
      );

      connection.release();

      const changes = {};
      if (title !== currentBook[0].Title) changes.title = title;
      if (author !== currentBook[0].Author) changes.author = author;
      if (publisher !== currentBook[0].Publisher) changes.publisher = publisher;

      await logAuditAction(req.user.userId, 'UPDATE', 'EBooks', bookId, changes, req.ip, 200);

      res.json({
        success: true,
        message: 'Book updated successfully'
      });
    } catch (error) {
      connection.release();
      throw error;
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating book',
      error: error.message
    });
  }
});

// FR4: Delete/Archive book (Admin only)
router.delete('/books/:bookId', authenticateToken, authorize(['Admin']), async (req, res) => {
  try {
    const { bookId } = req.params;

    const connection = await pool.getConnection();

    try {
      // Soft delete - mark as unavailable
      await connection.query(
        'UPDATE ebooks SET IsAvailable = 0 WHERE BookID = ?',
        [bookId]
      );

      connection.release();

      await logAuditAction(req.user.userId, 'DELETE', 'EBooks', bookId, {}, req.ip, 200);

      res.json({
        success: true,
        message: 'Book removed from catalog'
      });
    } catch (error) {
      connection.release();
      throw error;
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting book',
      error: error.message
    });
  }
});

// Get book statistics for dashboard
router.get('/books/stats/overview', authenticateToken, authorize(['Admin', 'Librarian']), async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const [stats] = await connection.query(`
      SELECT
        COUNT(*) as TotalBooks,
        SUM(CASE WHEN IsAvailable = 1 THEN 1 ELSE 0 END) as AvailableBooks,
        COUNT(DISTINCT CategoryID) as TotalCategories,
        SUM(ViewCount) as TotalViews,
        SUM(DownloadCount) as TotalDownloads,
        AVG(FileSizeMB) as AvgFileSize,
        MAX(UploadDate) as LastUploadDate
      FROM ebooks
    `);

    const [topBooks] = await connection.query(`
      SELECT BookID, Title, Author, ViewCount, DownloadCount
      FROM ebooks
      WHERE IsAvailable = 1
      ORDER BY ViewCount DESC
      LIMIT 5
    `);

    const [categoryStats] = await connection.query(`
      SELECT c.CategoryID, c.GenreName, COUNT(b.BookID) as BookCount
      FROM categories c
      LEFT JOIN ebooks b ON c.CategoryID = b.CategoryID AND b.IsAvailable = 1
      GROUP BY c.CategoryID
      ORDER BY BookCount DESC
    `);

    connection.release();

    res.json({
      success: true,
      data: {
        overview: stats[0],
        topBooks,
        categoryDistribution: categoryStats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
      error: error.message
    });
  }
});

// Export routes
module.exports = router;
