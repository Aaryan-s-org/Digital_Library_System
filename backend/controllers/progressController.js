const pool = require('../config/db');

/**
 * Get reading progress for a specific book
 */
exports.getProgress = async (req, res) => {
  try {
    const { bookId } = req.params;

    const connection = await pool.getConnection();
    const [members] = await connection.query(
      'SELECT MemberID FROM memberprofiles WHERE UserID = ?',
      [req.user.userId]
    );

    if (!members.length) {
      connection.release();
      return res.status(404).json({ success: false, message: 'Member profile not found' });
    }

    const [progress] = await connection.query(
      `SELECT rp.*, e.Title, e.Author, e.CoverImagePath
       FROM readingprogress rp
       JOIN ebooks e ON rp.BookID = e.BookID
       WHERE rp.MemberID = ? AND rp.BookID = ?`,
      [members[0].MemberID, bookId]
    );
    connection.release();

    res.json({
      success: true,
      data: progress.length ? progress[0] : null
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching progress', error: error.message });
  }
};

/**
 * Get all reading progress for current user
 */
exports.getAllProgress = async (req, res) => {
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

    const [progress] = await connection.query(
      `SELECT rp.*, e.Title, e.Author, e.CoverImagePath, c.GenreName
       FROM readingprogress rp
       JOIN ebooks e ON rp.BookID = e.BookID
       LEFT JOIN categories c ON e.CategoryID = c.CategoryID
       WHERE rp.MemberID = ?
       ORDER BY rp.LastAccessed DESC`,
      [members[0].MemberID]
    );
    connection.release();

    res.json({ success: true, data: progress });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching progress', error: error.message });
  }
};

/**
 * Update reading progress (upsert)
 */
exports.updateProgress = async (req, res) => {
  try {
    const { bookId } = req.params;
    const { lastPageRead, completionPct, cfi } = req.body;

    const connection = await pool.getConnection();
    const [members] = await connection.query(
      'SELECT MemberID FROM memberprofiles WHERE UserID = ?',
      [req.user.userId]
    );

    if (!members.length) {
      connection.release();
      return res.status(404).json({ success: false, message: 'Member profile not found' });
    }

    const memberId = members[0].MemberID;

    await connection.query(
      `INSERT INTO readingprogress (MemberID, BookID, LastPageRead, CompletionPct, LastAccessed)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE
         LastPageRead = VALUES(LastPageRead),
         CompletionPct = VALUES(CompletionPct),
         LastAccessed = CURRENT_TIMESTAMP`,
      [memberId, bookId, lastPageRead || 0, completionPct || 0]
    );

    // Update member's last active date
    await connection.query(
      'UPDATE memberprofiles SET LastActiveDate = CURRENT_TIMESTAMP WHERE MemberID = ?',
      [memberId]
    );

    connection.release();

    res.json({ success: true, message: 'Progress updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating progress', error: error.message });
  }
};
