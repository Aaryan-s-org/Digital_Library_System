const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access token required' 
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ 
        success: false, 
        message: 'Invalid or expired token' 
      });
    }
    req.user = user;
    next();
  });
};

// Role-Based Authorization Middleware
const authorize = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      const connection = await pool.getConnection();
      const [users] = await connection.query(
        'SELECT u.RoleID, r.RoleName FROM users u JOIN roles r ON u.RoleID = r.RoleID WHERE u.UserID = ?',
        [req.user.userId]
      );
      connection.release();

      if (!users.length) {
        return res.status(403).json({ 
          success: false, 
          message: 'User not found' 
        });
      }

      const userRole = users[0].RoleName;
      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({ 
          success: false, 
          message: 'Insufficient permissions' 
        });
      }

      req.userRole = userRole;
      next();
    } catch (error) {
      return res.status(500).json({ 
        success: false, 
        message: 'Authorization error',
        error: error.message 
      });
    }
  };
};

module.exports = { authenticateToken, authorize };
