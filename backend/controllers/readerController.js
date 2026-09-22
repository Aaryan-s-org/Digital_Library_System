const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const logAuditAction = require('../middleware/auditMiddleware');

/**
 * Stream an EPUB file securely (requires authentication)
 */
exports.streamBook = async (req, res) => {
  try {
    const { bookId } = req.params;

    const connection = await pool.getConnection();
    const [books] = await connection.query(
      'SELECT BookID, Title, FilePath, Format FROM ebooks WHERE BookID = ? AND IsAvailable = 1',
      [bookId]
    );

    if (!books.length) {
      connection.release();
      return res.status(404).json({ success: false, message: 'Book not found' });
    }

    const book = books[0];
    const filePath = path.resolve(__dirname, '..', book.FilePath);

    if (!fs.existsSync(filePath)) {
      connection.release();
      return res.status(404).json({ success: false, message: 'Book file not found on server' });
    }

    // Log access
    try {
      // Get member ID from user
      const [members] = await connection.query(
        'SELECT MemberID FROM memberprofiles WHERE UserID = ?',
        [req.user.userId]
      );
      const memberId = members.length ? members[0].MemberID : null;

      if (memberId) {
        await connection.query(
          `INSERT INTO accesslogs (MemberID, BookID, IPAddress, DeviceType)
           VALUES (?, ?, ?, ?)`,
          [memberId, bookId, req.ip || '0.0.0.0', req.headers['user-agent'] || 'Unknown']
        );
      }
    } catch (logErr) {
      console.error('Access log error:', logErr);
    }

    // Increment view count
    await connection.query(
      'UPDATE ebooks SET ViewCount = ViewCount + 1 WHERE BookID = ?',
      [bookId]
    );

    connection.release();

    // Set content type and stream the file
    const mimeType = book.Format === 'EPUB' ? 'application/epub+zip' : 'application/pdf';
    const stat = fs.statSync(filePath);

    res.set({
      'Content-Type': mimeType,
      'Content-Length': stat.size,
      'Content-Disposition': `inline; filename="${book.Title}.${book.Format.toLowerCase()}"`,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Content-Type-Options': 'nosniff'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);

  } catch (error) {
    console.error('Stream error:', error);
    res.status(500).json({ success: false, message: 'Error streaming book', error: error.message });
  }
};

/**
 * Get book info for the reader (metadata + progress)
 */
exports.getReaderInfo = async (req, res) => {
  try {
    const { bookId } = req.params;

    const connection = await pool.getConnection();
    const [books] = await connection.query(
      `SELECT b.BookID, b.Title, b.Author, b.Format, b.TotalPages, b.CoverImagePath, c.GenreName
       FROM ebooks b
       LEFT JOIN categories c ON b.CategoryID = c.CategoryID
       WHERE b.BookID = ? AND b.IsAvailable = 1`,
      [bookId]
    );

    if (!books.length) {
      connection.release();
      return res.status(404).json({ success: false, message: 'Book not found' });
    }

    // Get reading progress if member
    let progress = null;
    const [members] = await connection.query(
      'SELECT MemberID FROM memberprofiles WHERE UserID = ?',
      [req.user.userId]
    );

    if (members.length) {
      const [progressRows] = await connection.query(
        'SELECT LastPageRead, CompletionPct, LastAccessed FROM readingprogress WHERE MemberID = ? AND BookID = ?',
        [members[0].MemberID, bookId]
      );
      if (progressRows.length) {
        progress = progressRows[0];
      }
    }

    // Get bookmarks
    let bookmarks = [];
    if (members.length) {
      const [bookmarkRows] = await connection.query(
        'SELECT BookmarkID, PageNumber, CFI, NoteText, CreatedAt FROM bookmarks WHERE MemberID = ? AND BookID = ? ORDER BY CreatedAt DESC',
        [members[0].MemberID, bookId]
      );
      bookmarks = bookmarkRows;
    }

    connection.release();

    res.json({
      success: true,
      data: {
        book: books[0],
        progress,
        bookmarks
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching reader info', error: error.message });
  }
};
