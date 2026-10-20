const pool = require('../config/db');
const logAuditAction = require('../middleware/auditMiddleware');

exports.getAllMembers = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [members] = await connection.query(
      `SELECT mp.MemberID, u.UserID, u.Username, u.Email, mp.FullName, mp.SubscriptionTier,
              mp.RegistrationDate, mp.LastActiveDate, mp.IsVerified, mp.Department
       FROM memberprofiles mp
       JOIN users u ON mp.UserID = u.UserID
       ORDER BY mp.RegistrationDate DESC`
    );
    connection.release();

    res.json({ 
      success: true, 
      data: members 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching members',
      error: error.message 
    });
  }
};

exports.getMemberById = async (req, res) => {
  try {
    const { memberId } = req.params;

    const connection = await pool.getConnection();
    const [members] = await connection.query(
      `SELECT mp.*, u.Username, u.Email, u.IsActive
       FROM memberprofiles mp
       JOIN users u ON mp.UserID = u.UserID
       WHERE mp.MemberID = ?`,
      [memberId]
    );
    connection.release();

    if (!members.length) {
      return res.status(404).json({ 
        success: false, 
        message: 'Member not found' 
      });
    }

    res.json({ 
      success: true, 
      data: members[0] 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching member',
      error: error.message 
    });
  }
};

exports.updateMemberProfile = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { fullName, phoneNumber, department, enrollmentYear } = req.body;

    const connection = await pool.getConnection();
    
    try {
      await connection.query(
        `UPDATE memberprofiles 
         SET FullName = COALESCE(?, FullName),
             PhoneNumber = COALESCE(?, PhoneNumber),
             Department = COALESCE(?, Department),
             EnrollmentYear = COALESCE(?, EnrollmentYear),
             LastActiveDate = CURRENT_TIMESTAMP
         WHERE MemberID = ?`,
        [fullName, phoneNumber, department, enrollmentYear, memberId]
      );

      connection.release();

      await logAuditAction(req.user.userId, 'UPDATE', 'MemberProfiles', memberId, req.body, req.ip, 200);

      res.json({ 
        success: true, 
        message: 'Member profile updated' 
      });
    } catch (error) {
      connection.release();
      throw error;
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error updating member',
      error: error.message 
    });
  }
};

exports.updateSubscriptionTier = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { subscriptionTier } = req.body;

    if (!['Free', 'Premium'].includes(subscriptionTier)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid subscription tier' 
      });
    }

    const connection = await pool.getConnection();
    
    try {
      await connection.query(
        'UPDATE memberprofiles SET SubscriptionTier = ? WHERE MemberID = ?',
        [subscriptionTier, memberId]
      );

      connection.release();

      await logAuditAction(req.user.userId, 'UPDATE', 'MemberProfiles', memberId, { subscriptionTier }, req.ip, 200);

      res.json({ 
        success: true, 
        message: 'Subscription tier updated' 
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
};

exports.deactivateUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (userId == req.user.userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot deactivate your own account' 
      });
    }

    const connection = await pool.getConnection();
    
    try {
      await connection.query(
        'UPDATE users SET IsActive = 0 WHERE UserID = ?',
        [userId]
      );

      connection.release();

      await logAuditAction(req.user.userId, 'DEACTIVATE', 'Users', userId, {}, req.ip, 200);

      res.json({ 
        success: true, 
        message: 'User deactivated' 
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
};
