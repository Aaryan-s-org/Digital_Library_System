const pool = require('../config/db');
const logAuditAction = require('../middleware/auditMiddleware');

exports.getAllBooks = async (req, res) => {
  try {
    const { page = 1, limit = 20, category, search } = req.query;
    const offset = (page - 1) * limit;

    let query = `SELECT b.*, c.GenreName, COUNT(DISTINCT al.LogID) as AccessCount
                 FROM ebooks b
                 LEFT JOIN categories c ON b.CategoryID = c.CategoryID
                 LEFT JOIN accesslogs al ON b.BookID = al.BookID
                 WHERE b.IsAvailable = 1`;
    let params = [];

    if (category) {
      query += ` AND c.CategoryID = ?`;
      params.push(category);
    }

    if (search) {
      query += ` AND (b.Title LIKE ? OR b.Author LIKE ? OR b.ISBN LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` GROUP BY b.BookID ORDER BY b.UploadDate DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const connection = await pool.getConnection();
    const [books] = await connection.query(query, params);
    
    const [countResult] = await connection.query(
      'SELECT COUNT(*) as total FROM ebooks WHERE IsAvailable = 1'
    );
    connection.release();

    res.json({ 
      success: true, 
      data: books,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching books',
      error: error.message 
    });
  }
};

exports.getBookById = async (req, res) => {
  try {
    const { bookId } = req.params;

    const connection = await pool.getConnection();
    const [books] = await connection.query(
      `SELECT b.*, c.GenreName, u.Username as UploadedByName,
              COUNT(DISTINCT al.LogID) as AccessCount
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

    // Increment view count
    await connection.query(
      'UPDATE ebooks SET ViewCount = ViewCount + 1 WHERE BookID = ?',
      [bookId]
    );

    connection.release();

    res.json({ 
      success: true, 
      data: books[0] 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching book',
      error: error.message 
    });
  }
};

exports.createBook = async (req, res) => {
  try {
    const { title, author, isbn, categoryId, publisher, publishedDate, description, format, filePath, fileSize } = req.body;

    if (!title || !author || !isbn || !categoryId || !format || !filePath || !fileSize) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }

    const connection = await pool.getConnection();
    
    try {
      const [result] = await connection.query(
        `INSERT INTO ebooks (CategoryID, Title, Author, ISBN, Publisher, PublishedDate, 
                             Description, Format, FilePath, FileSizeMB, UploadedBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [categoryId, title, author, isbn, publisher, publishedDate, description, format, filePath, fileSize, req.user.userId]
      );

      connection.release();

      const bookId = result.insertId;
      await logAuditAction(req.user.userId, 'CREATE', 'EBooks', bookId, { title, author, isbn }, req.ip, 201);

      res.status(201).json({ 
        success: true, 
        message: 'Book uploaded successfully',
        bookId
      });
    } catch (error) {
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Book creation error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ 
        success: false, 
        message: 'ISBN already exists' 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Error uploading book',
      error: error.message 
    });
  }
};

exports.updateBook = async (req, res) => {
  try {
    const { bookId } = req.params;
    const { title, author, publisher, description, categoryId } = req.body;

    const connection = await pool.getConnection();
    
    try {
      await connection.query(
        `UPDATE ebooks 
         SET Title = COALESCE(?, Title),
             Author = COALESCE(?, Author),
             Publisher = COALESCE(?, Publisher),
             Description = COALESCE(?, Description),
             CategoryID = COALESCE(?, CategoryID),
             LastUpdated = CURRENT_TIMESTAMP
         WHERE BookID = ?`,
        [title, author, publisher, description, categoryId, bookId]
      );

      connection.release();

      await logAuditAction(req.user.userId, 'UPDATE', 'EBooks', bookId, req.body, req.ip, 200);

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
};

exports.deleteBook = async (req, res) => {
  try {
    const { bookId } = req.params;

    const connection = await pool.getConnection();
    
    try {
      await connection.query(
        'UPDATE ebooks SET IsAvailable = 0 WHERE BookID = ?',
        [bookId]
      );

      connection.release();

      await logAuditAction(req.user.userId, 'DELETE', 'EBooks', bookId, {}, req.ip, 200);

      res.json({ 
        success: true, 
        message: 'Book deleted' 
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
};
