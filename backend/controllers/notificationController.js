const pool = require('../config/db');

/**
 * Get notifications for current user
 */
exports.getNotifications = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [members] = await connection.query(
      'SELECT MemberID FROM memberprofiles WHERE UserID = ?',
      [req.user.userId]
    );

    if (!members.length) {
      connection.release();
      return res.json({ success: true, data: [], unreadCount: 0 });
    }

    const [notifications] = await connection.query(
      `SELECT * FROM notifications 
       WHERE MemberID = ?
       ORDER BY SentDate DESC
       LIMIT 50`,
      [members[0].MemberID]
    );

    const [unread] = await connection.query(
      'SELECT COUNT(*) as count FROM notifications WHERE MemberID = ? AND IsRead = 0',
      [members[0].MemberID]
    );

    connection.release();

    res.json({
      success: true,
      data: notifications,
      unreadCount: unread[0].count
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching notifications', error: error.message });
  }
};

/**
 * Mark a notification as read
 */
exports.markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const connection = await pool.getConnection();
    await connection.query(
      'UPDATE notifications SET IsRead = 1 WHERE NotificationID = ?',
      [notificationId]
    );
    connection.release();

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating notification', error: error.message });
  }
};

/**
 * Mark all notifications as read
 */
exports.markAllAsRead = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [members] = await connection.query(
      'SELECT MemberID FROM memberprofiles WHERE UserID = ?',
      [req.user.userId]
    );

    if (members.length) {
      await connection.query(
        'UPDATE notifications SET IsRead = 1 WHERE MemberID = ? AND IsRead = 0',
        [members[0].MemberID]
      );
    }
    connection.release();

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating notifications', error: error.message });
  }
};

/**
 * Create a notification (used by system/admin)
 */
exports.createNotification = async (req, res) => {
  try {
    const { memberId, message, notificationType } = req.body;

    if (!memberId || !message) {
      return res.status(400).json({ success: false, message: 'MemberID and message required' });
    }

    const connection = await pool.getConnection();
    const [result] = await connection.query(
      `INSERT INTO notifications (MemberID, Message, NotificationType)
       VALUES (?, ?, ?)`,
      [memberId, message, notificationType || 'info']
    );
    connection.release();

    res.status(201).json({
      success: true,
      message: 'Notification created',
      notificationId: result.insertId
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating notification', error: error.message });
  }
};

/**
 * Broadcast notification to all members (Admin only)
 */
exports.broadcastNotification = async (req, res) => {
  try {
    const { message, notificationType } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, message: 'Message required' });
    }

    const connection = await pool.getConnection();
    const [members] = await connection.query('SELECT MemberID FROM memberprofiles');

    const values = members.map(m => [m.MemberID, message, notificationType || 'system']);
    if (values.length > 0) {
      await connection.query(
        'INSERT INTO notifications (MemberID, Message, NotificationType) VALUES ?',
        [values]
      );
    }
    connection.release();

    res.status(201).json({
      success: true,
      message: `Notification sent to ${members.length} members`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error broadcasting notification', error: error.message });
  }
};
