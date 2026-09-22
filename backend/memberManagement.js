// Member Management Module - Team 1
// Comprehensive member and user management system

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');

// ===========================
// Member Management Routes
// ===========================

// FR1: Get all members with filtering
router.get('/members', authenticateToken, authorize(['Admin', 'Librarian']), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      subscriptionTier,
      isVerified,
      sortBy = 'RegistrationDate',
      sortOrder = 'DESC',
      department,
      yearFrom,
      yearTo
    } = req.query;

    const offset = (page - 1) * limit;
    let query = `
      SELECT 
        mp.MemberID,
        u.UserID,
        u.Username,
        u.Email,
        u.IsActive,
        u.LastLogin,
        mp.FullName,
        mp.PhoneNumber,
        mp.SubscriptionTier,
        mp.RegistrationDate,
        mp.LastActiveDate,
        mp.IsVerified,
        mp.Department,
        mp.EnrollmentYear,
        (SELECT COUNT(*) FROM accesslogs WHERE MemberID = mp.MemberID) as ReadingSessions,
        (SELECT COUNT(*) FROM bookmarks WHERE MemberID = mp.MemberID) as BookmarksCount
      FROM memberprofiles mp
      JOIN users u ON mp.UserID = u.UserID
      WHERE 1=1
    `;
    let params = [];

    // Filters
    if (search) {
      query += ` AND (mp.FullName LIKE ? OR u.Email LIKE ? OR u.Username LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (subscriptionTier) {
      query += ` AND mp.SubscriptionTier = ?`;
      params.push(subscriptionTier);
    }

    if (isVerified !== undefined) {
      query += ` AND mp.IsVerified = ?`;
      params.push(isVerified === 'true' ? 1 : 0);
    }

    if (department) {
      query += ` AND mp.Department = ?`;
      params.push(department);
    }

    if (yearFrom) {
      query += ` AND mp.EnrollmentYear >= ?`;
      params.push(yearFrom);
    }

    if (yearTo) {
      query += ` AND mp.EnrollmentYear <= ?`;
      params.push(yearTo);
    }

    // Sorting
    const allowedSortBy = ['RegistrationDate', 'FullName', 'SubscriptionTier', 'LastActiveDate'];
    const sortByField = allowedSortBy.includes(sortBy) ? sortBy : 'RegistrationDate';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    query += ` ORDER BY mp.${sortByField} ${order}`;
    query += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const connection = await pool.getConnection();
    const [members] = await connection.query(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM memberprofiles mp
                      JOIN users u ON mp.UserID = u.UserID WHERE 1=1`;
    let countParams = [];

    if (search) {
      countQuery += ` AND (mp.FullName LIKE ? OR u.Email LIKE ?)`;
      countParams.push(`%${search}%`, `%${search}%`);
    }
    if (subscriptionTier) {
      countQuery += ` AND mp.SubscriptionTier = ?`;
      countParams.push(subscriptionTier);
    }

    const [countResult] = await connection.query(countQuery, countParams);
    connection.release();

    res.json({
      success: true,
      data: members,
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
      message: 'Error fetching members',
      error: error.message
    });
  }
});

// Get member profile with detailed information
router.get('/members/:memberId', authenticateToken, async (req, res) => {
  try {
    const { memberId } = req.params;

    // Authorization: User can view own profile, Admin/Librarian can view any
    const isOwnProfile = req.user.userId === memberId;
    const isAdmin = req.userRole && ['Admin', 'Librarian'].includes(req.userRole);

    if (!isOwnProfile && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    const connection = await pool.getConnection();

    const [members] = await connection.query(
      `SELECT 
        mp.*,
        u.UserID,
        u.Username,
        u.Email,
        u.IsActive,
        u.LastLogin,
        u.CreatedAt,
        (SELECT COUNT(*) FROM accesslogs WHERE MemberID = mp.MemberID) as TotalReadingSessions,
        (SELECT SUM(SessionDuration) FROM accesslogs WHERE MemberID = mp.MemberID) as TotalReadTime,
        (SELECT COUNT(*) FROM bookmarks WHERE MemberID = mp.MemberID) as TotalBookmarks,
        (SELECT COUNT(DISTINCT BookID) FROM accesslogs WHERE MemberID = mp.MemberID) as BooksAccessed
       FROM memberprofiles mp
       JOIN users u ON mp.UserID = u.UserID
       WHERE mp.MemberID = ?`,
      [memberId]
    );

    if (!members.length) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    const member = members[0];

    // Get reading activity summary
    const [readingActivity] = await connection.query(
      `SELECT 
        DATE(AccessTimestamp) as Date,
        COUNT(*) as SessionCount,
        SUM(SessionDuration) as TotalMinutes
       FROM accesslogs
       WHERE MemberID = ?
       GROUP BY DATE(AccessTimestamp)
       ORDER BY Date DESC
       LIMIT 30`,
      [memberId]
    );

    connection.release();

    res.json({
      success: true,
      data: {
        profile: member,
        activity: {
          totalSessions: member.TotalReadingSessions || 0,
          totalReadTime: member.TotalReadTime || 0,
          totalBookmarks: member.TotalBookmarks || 0,
          booksAccessed: member.BooksAccessed || 0,
          recentActivity: readingActivity
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching member',
      error: error.message
    });
  }
});

// FR1: Update member profile
router.put('/members/:memberId', authenticateToken, async (req, res) => {
  try {
    const { memberId } = req.params;
    const {
      fullName,
      phoneNumber,
      department,
      enrollmentYear,
      profilePicture
    } = req.body;

    // Authorization: User can update own profile, Admin can update any
    const isOwnProfile = req.user.userId === memberId;
    const isAdmin = req.userRole && req.userRole === 'Admin';

    if (!isOwnProfile && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    const connection = await pool.getConnection();

    try {
      await connection.query(
        `UPDATE memberprofiles
         SET FullName = COALESCE(?, FullName),
             PhoneNumber = COALESCE(?, PhoneNumber),
             Department = COALESCE(?, Department),
             EnrollmentYear = COALESCE(?, EnrollmentYear),
             ProfilePicture = COALESCE(?, ProfilePicture),
             LastActiveDate = CURRENT_TIMESTAMP
         WHERE MemberID = ?`,
        [fullName, phoneNumber, department, enrollmentYear, profilePicture, memberId]
      );

      connection.release();

      await logAuditAction(req.user.userId, 'UPDATE', 'MemberProfiles', memberId, {
        fullName,
        department,
        enrollmentYear
      }, req.ip, 200);

      res.json({
        success: true,
        message: 'Member profile updated successfully'
      });
    } catch (error) {
      connection.release();
      throw error;
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating member profile',
      error: error.message
    });
  }
});

// FR1: Update subscription tier (Admin only)
router.put('/members/:memberId/subscription', authenticateToken, authorize(['Admin']), async (req, res) => {
  try {
    const { memberId } = req.params;
    const { subscriptionTier } = req.body;

    if (!['Free', 'Premium'].includes(subscriptionTier)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subscription tier. Must be "Free" or "Premium"'
      });
    }

    const connection = await pool.getConnection();

    try {
      const [result] = await connection.query(
        'UPDATE memberprofiles SET SubscriptionTier = ? WHERE MemberID = ?',
        [subscriptionTier, memberId]
      );

      if (result.affectedRows === 0) {
        connection.release();
        return res.status(404).json({
          success: false,
          message: 'Member not found'
        });
      }

      connection.release();

      await logAuditAction(req.user.userId, 'UPDATE', 'MemberProfiles', memberId, {
        subscriptionTier
      }, req.ip, 200);

      res.json({
        success: true,
        message: `Subscription tier updated to ${subscriptionTier}`
      });
    } catch (error) {
      connection.release();
      throw error;
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating subscription',
      error: error.message
    });
  }
});

// FR1: Change password (User self-service)
router.post('/members/:memberId/change-password', authenticateToken, async (req, res) => {
  try {
    const { memberId } = req.params;
    const { currentPassword, newPassword } = req.body;

    // Authorization: User can only change own password
    if (req.user.userId != memberId) {
      return res.status(403).json({
        success: false,
        message: 'You can only change your own password'
      });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      });
    }

    const connection = await pool.getConnection();

    try {
      // Get user record
      const [users] = await connection.query(
        `SELECT u.UserID, u.PasswordHash FROM users u
         JOIN memberprofiles mp ON u.UserID = mp.UserID
         WHERE mp.MemberID = ?`,
        [memberId]
      );

      if (!users.length) {
        connection.release();
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const user = users[0];

      // Verify current password
      const isPasswordValid = await bcrypt.compare(currentPassword, user.PasswordHash);
      if (!isPasswordValid) {
        connection.release();
        await logAuditAction(req.user.userId, 'PASSWORD_CHANGE_FAILED', 'Users', user.UserID, 
          { reason: 'Invalid current password' }, req.ip, 401);
        
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, 10);

      // Update password
      await connection.query(
        'UPDATE users SET PasswordHash = ? WHERE UserID = ?',
        [newPasswordHash, user.UserID]
      );

      connection.release();

      await logAuditAction(req.user.userId, 'PASSWORD_CHANGED', 'Users', user.UserID, {}, req.ip, 200);

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      connection.release();
      throw error;
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error changing password',
      error: error.message
    });
  }
});

// Verify email (send verification link)
router.post('/members/:memberId/verify-email', authenticateToken, async (req, res) => {
  try {
    const { memberId } = req.params;

    // In production, send verification email here
    // For now, just mark as verified (admin override)

    const connection = await pool.getConnection();

    try {
      const [result] = await connection.query(
        'UPDATE memberprofiles SET IsVerified = 1 WHERE MemberID = ?',
        [memberId]
      );

      if (result.affectedRows === 0) {
        connection.release();
        return res.status(404).json({
          success: false,
          message: 'Member not found'
        });
      }

      connection.release();

      res.json({
        success: true,
        message: 'Email verified successfully'
      });
    } catch (error) {
      connection.release();
      throw error;
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error verifying email',
      error: error.message
    });
  }
});

// FR1: Deactivate user account (Admin only)
router.post('/users/:userId/deactivate', authenticateToken, authorize(['Admin']), async (req, res) => {
  try {
    const { userId } = req.params;

    // Prevent self-deactivation
    if (userId == req.user.userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate your own account'
      });
    }

    const connection = await pool.getConnection();

    try {
      const [result] = await connection.query(
        'UPDATE users SET IsActive = 0 WHERE UserID = ?',
        [userId]
      );

      if (result.affectedRows === 0) {
        connection.release();
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      connection.release();

      await logAuditAction(req.user.userId, 'DEACTIVATE', 'Users', userId, {}, req.ip, 200);

      res.json({
        success: true,
        message: 'User account deactivated'
      });
    } catch (error) {
      connection.release();
      throw error;
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deactivating user',
      error: error.message
    });
  }
});

// FR1: Reactivate user account (Admin only)
router.post('/users/:userId/activate', authenticateToken, authorize(['Admin']), async (req, res) => {
  try {
    const { userId } = req.params;

    const connection = await pool.getConnection();

    try {
      const [result] = await connection.query(
        'UPDATE users SET IsActive = 1 WHERE UserID = ?',
        [userId]
      );

      if (result.affectedRows === 0) {
        connection.release();
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      connection.release();

      await logAuditAction(req.user.userId, 'ACTIVATE', 'Users', userId, {}, req.ip, 200);

      res.json({
        success: true,
        message: 'User account reactivated'
      });
    } catch (error) {
      connection.release();
      throw error;
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error activating user',
      error: error.message
    });
  }
});

// Get member statistics for admin dashboard
router.get('/members/stats/overview', authenticateToken, authorize(['Admin', 'Librarian']), async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const [stats] = await connection.query(`
      SELECT
        COUNT(*) as TotalMembers,
        SUM(CASE WHEN mp.SubscriptionTier = 'Premium' THEN 1 ELSE 0 END) as PremiumMembers,
        SUM(CASE WHEN mp.IsVerified = 1 THEN 1 ELSE 0 END) as VerifiedMembers,
        SUM(CASE WHEN u.IsActive = 1 THEN 1 ELSE 0 END) as ActiveMembers,
        COUNT(DISTINCT mp.Department) as TotalDepartments,
        MAX(mp.RegistrationDate) as LatestMemberRegistration
      FROM memberprofiles mp
      JOIN users u ON mp.UserID = u.UserID
    `);

    const [subscriptionStats] = await connection.query(`
      SELECT SubscriptionTier, COUNT(*) as Count
      FROM memberprofiles
      GROUP BY SubscriptionTier
    `);

    const [departmentStats] = await connection.query(`
      SELECT Department, COUNT(*) as MemberCount
      FROM memberprofiles
      WHERE Department IS NOT NULL
      GROUP BY Department
      ORDER BY MemberCount DESC
      LIMIT 10
    `);

    const [activityStats] = await connection.query(`
      SELECT 
        DATE(CURRENT_DATE - INTERVAL 30 DAY) as Date,
        COUNT(DISTINCT MemberID) as NewMembers
      FROM memberprofiles
      WHERE RegistrationDate >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
      GROUP BY DATE(RegistrationDate)
      ORDER BY Date
    `);

    connection.release();

    res.json({
      success: true,
      data: {
        overview: stats[0],
        subscriptionDistribution: subscriptionStats,
        departmentDistribution: departmentStats,
        recentActivity: activityStats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching member statistics',
      error: error.message
    });
  }
});

// Export routes
module.exports = router;
