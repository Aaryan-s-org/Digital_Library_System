const pool = require('../config/db');

// Audit Logging Middleware
const logAuditAction = async (userId, actionType, resourceType, resourceId, details, ipAddress, statusCode) => {
  try {
    const connection = await pool.getConnection();
    await connection.query(
      `INSERT INTO auditlogs (UserID, ActionType, ResourceType, ResourceID, ActionDetails, IPAddress, StatusCode)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, actionType, resourceType, resourceId, JSON.stringify(details), ipAddress, statusCode]
    );
    connection.release();
  } catch (error) {
    console.error('Audit logging error:', error);
  }
};

module.exports = logAuditAction;
