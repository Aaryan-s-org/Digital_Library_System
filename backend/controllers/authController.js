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

      await logAuditAction(req.user.userId, 'REGISTER', 'Users', userId, { username, email, roleId }, req.ip, 201);

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
