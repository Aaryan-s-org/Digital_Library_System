const pool = require('../config/db');

/**
 * Get audit logs with filtering and pagination
 */
exports.getAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 25, actionType, userId, startDate, endDate } = req.query;
    const offset = (page - 1) * limit;

    let query = `SELECT al.*, u.Username 
                 FROM auditlogs al
                 LEFT JOIN users u ON al.UserID = u.UserID
                 WHERE 1=1`;
    let params = [];

    if (actionType) {
      query += ' AND al.ActionType = ?';
      params.push(actionType);
    }
    if (userId) {
      query += ' AND al.UserID = ?';
      params.push(userId);
    }
    if (startDate) {
      query += ' AND al.Timestamp >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND al.Timestamp <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY al.Timestamp DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const connection = await pool.getConnection();
    const [logs] = await connection.query(query, params);

    const [countResult] = await connection.query(
      'SELECT COUNT(*) as total FROM auditlogs'
    );
    connection.release();

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching audit logs', error: error.message });
  }
};

/**
 * Get audit statistics for dashboard
 */
exports.getAuditStats = async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const [totalLogs] = await connection.query('SELECT COUNT(*) as total FROM auditlogs');
    const [todayLogs] = await connection.query(
      'SELECT COUNT(*) as total FROM auditlogs WHERE DATE(Timestamp) = CURDATE()'
    );
    const [actionBreakdown] = await connection.query(
      `SELECT ActionType, COUNT(*) as count 
       FROM auditlogs 
       GROUP BY ActionType 
       ORDER BY count DESC 
       LIMIT 10`
    );
    const [recentActivity] = await connection.query(
      `SELECT al.*, u.Username 
       FROM auditlogs al
       LEFT JOIN users u ON al.UserID = u.UserID
       ORDER BY al.Timestamp DESC 
       LIMIT 10`
    );

    connection.release();

    res.json({
      success: true,
      data: {
        totalLogs: totalLogs[0].total,
        todayLogs: todayLogs[0].total,
        actionBreakdown,
        recentActivity
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching audit stats', error: error.message });
  }
};

/**
 * Get system-wide dashboard stats
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const [users] = await connection.query('SELECT COUNT(*) as total FROM users WHERE IsActive = 1');
    const [books] = await connection.query('SELECT COUNT(*) as total FROM ebooks WHERE IsAvailable = 1');
    const [members] = await connection.query('SELECT COUNT(*) as total FROM memberprofiles');
    const [todaySessions] = await connection.query(
      'SELECT COUNT(*) as total FROM accesslogs WHERE DATE(AccessTimestamp) = CURDATE()'
    );
    const [premiumMembers] = await connection.query(
      "SELECT COUNT(*) as total FROM memberprofiles WHERE SubscriptionTier = 'Premium'"
    );
    const [recentBooks] = await connection.query(
      'SELECT COUNT(*) as total FROM ebooks WHERE UploadDate >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND IsAvailable = 1'
    );

    connection.release();

    res.json({
      success: true,
      data: {
        totalUsers: users[0].total,
        totalBooks: books[0].total,
        totalMembers: members[0].total,
        activeSessions: todaySessions[0].total,
        premiumMembers: premiumMembers[0].total,
        recentBooks: recentBooks[0].total
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching dashboard stats', error: error.message });
  }
};
