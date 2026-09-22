const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const logAuditAction = require('../middleware/auditMiddleware');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const BCRYPT_ROUNDS = 10;

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username and password required' 
      });
    }

    const connection = await pool.getConnection();
    const [users] = await connection.query(
      `SELECT u.UserID, u.Username, u.PasswordHash, u.IsActive, u.Email, r.RoleName 
       FROM users u
       JOIN roles r ON u.RoleID = r.RoleID
       WHERE u.Username = ?`,
      [username]
    );
    connection.release();

    if (!users.length) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    const user = users[0];

    if (!user.IsActive) {
      return res.status(401).json({ 
        success: false, 
        message: 'Account is disabled' 
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.PasswordHash);
    if (!passwordMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    const token = jwt.sign(
      { userId: user.UserID, username: user.Username, role: user.RoleName },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Update last login
    const conn = await pool.getConnection();
    await conn.query(
      'UPDATE users SET LastLogin = CURRENT_TIMESTAMP WHERE UserID = ?',
      [user.UserID]
    );
    conn.release();

    await logAuditAction(user.UserID, 'LOGIN', 'Users', user.UserID, { username }, req.ip, 200);

    res.json({ 
      success: true, 
      message: 'Login successful',
      token,
      user: {
        userId: user.UserID,
        username: user.Username,
        email: user.Email,
        role: user.RoleName
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message 
    });
  }
};

/**
 * Public member self-registration (no token required)
 */
exports.signup = async (req, res) => {
  try {
    const { username, email, password, fullName } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username, email, and password are required' 
      });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const connection = await pool.getConnection();
    
    try {
      // Create user with Member role (RoleID = 3)
      const [result] = await connection.query(
        `INSERT INTO users (Username, Email, PasswordHash, RoleID, IsActive)
         VALUES (?, ?, ?, 3, 1)`,
        [username, email, passwordHash]
      );

      const userId = result.insertId;

      // Create member profile
      await connection.query(
        `INSERT INTO memberprofiles (UserID, FullName, Email, IsVerified)
         VALUES (?, ?, ?, 0)`,
        [userId, fullName || username, email]
      );

      // Create welcome notification
      const [memberRows] = await connection.query(
        'SELECT MemberID FROM memberprofiles WHERE UserID = ?',
        [userId]
      );
      if (memberRows.length) {
        await connection.query(
          `INSERT INTO notifications (MemberID, Message, NotificationType)
           VALUES (?, 'Welcome to Lumina Library! Start exploring our collection.', 'welcome')`,
          [memberRows[0].MemberID]
        );
      }

      connection.release();

      // Auto-login: generate token
      const token = jwt.sign(
        { userId, username, role: 'Member' },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      await logAuditAction(userId, 'SIGNUP', 'Users', userId, { username, email }, req.ip, 201);

      res.status(201).json({ 
        success: true, 
        message: 'Account created successfully',
        token,
        user: {
          userId,
          username,
          email,
          role: 'Member'
        }
      });
    } catch (error) {
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Signup error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ 
        success: false, 
        message: 'Username or email already exists' 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Registration error',
      error: error.message 
    });
  }
};

/**
 * Admin-only user registration (requires admin token)
 */
exports.register = async (req, res) => {
  try {
    const { username, email, password, roleId = 3 } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields required' 
      });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const connection = await pool.getConnection();
    
    try {
      const [result] = await connection.query(
        `INSERT INTO users (Username, Email, PasswordHash, RoleID, IsActive)
         VALUES (?, ?, ?, ?, 1)`,
        [username, email, passwordHash, roleId]
      );

      const userId = result.insertId;

      // Create member profile if Member role
      if (roleId === 3) {
        await connection.query(
          `INSERT INTO memberprofiles (UserID, FullName, Email, IsVerified)
           VALUES (?, ?, ?, 0)`,
          [userId, username, email]
        );
      }

      connection.release();

      const adminUserId = req.user ? req.user.userId : userId;
      await logAuditAction(adminUserId, 'REGISTER', 'Users', userId, { username, email, roleId }, req.ip, 201);

      res.status(201).json({ 
        success: true, 
        message: 'User registered successfully',
        userId
      });
    } catch (error) {
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ 
        success: false, 
        message: 'Username or email already exists' 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Registration error',
      error: error.message 
    });
  }
};

/**
 * Get current user info from token
 */
exports.me = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [users] = await connection.query(
      `SELECT u.UserID, u.Username, u.Email, u.IsActive, u.LastLogin, u.CreatedAt, r.RoleName
       FROM users u
       JOIN roles r ON u.RoleID = r.RoleID
       WHERE u.UserID = ?`,
      [req.user.userId]
    );

    if (!users.length) {
      connection.release();
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Get member info if applicable
    let memberInfo = null;
    const [members] = await connection.query(
      'SELECT * FROM memberprofiles WHERE UserID = ?',
      [req.user.userId]
    );
    if (members.length) {
      memberInfo = members[0];
    }

    connection.release();

    res.json({
      success: true,
      data: {
        ...users[0],
        member: memberInfo
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching user info', error: error.message });
  }
};
