const pool = require('../config/db');

/**
 * Get bookmarks for a book
 */
exports.getBookmarks = async (req, res) => {
  try {
    const { bookId } = req.params;

    const connection = await pool.getConnection();
    const [members] = await connection.query(
      'SELECT MemberID FROM memberprofiles WHERE UserID = ?',
      [req.user.userId]
    );

    if (!members.length) {
      connection.release();
      return res.json({ success: true, data: [] });
    }

    const [bookmarks] = await connection.query(
      `SELECT b.*, e.Title
       FROM bookmarks b
       JOIN ebooks e ON b.BookID = e.BookID
       WHERE b.MemberID = ? AND b.BookID = ?
       ORDER BY b.CreatedAt DESC`,
      [members[0].MemberID, bookId]
    );
    connection.release();

    res.json({ success: true, data: bookmarks });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching bookmarks', error: error.message });
  }
};

/**
 * Get all bookmarks for current user
 */
exports.getAllBookmarks = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [members] = await connection.query(
      'SELECT MemberID FROM memberprofiles WHERE UserID = ?',
      [req.user.userId]
    );

    if (!members.length) {
      connection.release();
      return res.json({ success: true, data: [] });
    }

    const [bookmarks] = await connection.query(
      `SELECT b.*, e.Title, e.Author, e.CoverImagePath
       FROM bookmarks b
       JOIN ebooks e ON b.BookID = e.BookID
       WHERE b.MemberID = ?
       ORDER BY b.CreatedAt DESC`,
      [members[0].MemberID]
    );
    connection.release();

    res.json({ success: true, data: bookmarks });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching bookmarks', error: error.message });
  }
};

/**
 * Create a bookmark
 */
exports.createBookmark = async (req, res) => {
  try {
    const { bookId } = req.params;
    const { pageNumber, cfi, noteText } = req.body;

    const connection = await pool.getConnection();
    const [members] = await connection.query(
      'SELECT MemberID FROM memberprofiles WHERE UserID = ?',
      [req.user.userId]
    );

    if (!members.length) {
      connection.release();
      return res.status(404).json({ success: false, message: 'Member profile not found' });
    }

    const [result] = await connection.query(
      `INSERT INTO bookmarks (MemberID, BookID, PageNumber, CFI, NoteText)
       VALUES (?, ?, ?, ?, ?)`,
      [members[0].MemberID, bookId, pageNumber || 0, cfi || null, noteText || null]
    );
    connection.release();

    res.status(201).json({
      success: true,
      message: 'Bookmark created',
      bookmarkId: result.insertId
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating bookmark', error: error.message });
  }
};

/**
 * Update a bookmark's note
 */
exports.updateBookmark = async (req, res) => {
  try {
    const { bookmarkId } = req.params;
    const { noteText } = req.body;

    const connection = await pool.getConnection();
    await connection.query(
      'UPDATE bookmarks SET NoteText = ? WHERE BookmarkID = ?',
      [noteText, bookmarkId]
    );
    connection.release();

    res.json({ success: true, message: 'Bookmark updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating bookmark', error: error.message });
  }
};

/**
 * Delete a bookmark
 */
exports.deleteBookmark = async (req, res) => {
  try {
    const { bookmarkId } = req.params;

    const connection = await pool.getConnection();
    await connection.query('DELETE FROM bookmarks WHERE BookmarkID = ?', [bookmarkId]);
    connection.release();

    res.json({ success: true, message: 'Bookmark deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting bookmark', error: error.message });
  }
};
