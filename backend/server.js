const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const BCRYPT_ROUNDS = 10;

// Create connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'digital_library_portal',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelayMs: 0
});

// ===========================
// Middleware
// ===========================

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'frontend')));

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

// ===========================
// Team 1: Authentication & Authorization Routes
// ===========================

// FR2: User Login
app.post('/api/auth/login', async (req, res) => {
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
});

// FR1: User Registration (Admin only)
app.post('/api/auth/register', authenticateToken, authorize(['Admin']), async (req, res) => {
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
});

// ===========================
// Team 1: Member Management Routes (FR1)
// ===========================

// Get all members
app.get('/api/members', authenticateToken, authorize(['Admin', 'Librarian']), async (req, res) => {
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
});

// Get member profile by ID
app.get('/api/members/:memberId', authenticateToken, async (req, res) => {
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
});

// Update member profile
app.put('/api/members/:memberId', authenticateToken, async (req, res) => {
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
});

// Update subscription tier (Admin only)
app.put('/api/members/:memberId/subscription', authenticateToken, authorize(['Admin']), async (req, res) => {
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
});

// Deactivate user (Admin only)
app.post('/api/users/:userId/deactivate', authenticateToken, authorize(['Admin']), async (req, res) => {
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
});

// ===========================
// Team 1: Book Cataloging Routes (FR4, FR5)
// ===========================

// Get all books
app.get('/api/books', async (req, res) => {
  try {
    const { page = 1, limit = 20, category, search } = req.query;
    const offset = (page - 1) * limit;

    let query = `SELECT b.*, c.GenreName, COUNT(DISTINCT al.LogID) as AccessCount
                 FROM ebooks b
                 LEFT JOIN categories c ON b.CategoryID = c.CategoryID
                 LEFT JOIN accesslogs al ON b.BookID = al.BookID
                 WHERE b.IsAvailable = 1`;
    let params = [];

    if (category) {
      query += ` AND c.CategoryID = ?`;
      params.push(category);
    }

    if (search) {
      query += ` AND (b.Title LIKE ? OR b.Author LIKE ? OR b.ISBN LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` GROUP BY b.BookID ORDER BY b.UploadDate DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const connection = await pool.getConnection();
    const [books] = await connection.query(query, params);
    
    const [countResult] = await connection.query(
      'SELECT COUNT(*) as total FROM ebooks WHERE IsAvailable = 1'
    );
    connection.release();

    res.json({ 
      success: true, 
      data: books,
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
      message: 'Error fetching books',
      error: error.message 
    });
  }
});

// Get book details
app.get('/api/books/:bookId', async (req, res) => {
  try {
    const { bookId } = req.params;

    const connection = await pool.getConnection();
    const [books] = await connection.query(
      `SELECT b.*, c.GenreName, u.Username as UploadedByName,
              COUNT(DISTINCT al.LogID) as AccessCount
       FROM ebooks b
       LEFT JOIN categories c ON b.CategoryID = c.CategoryID
       LEFT JOIN users u ON b.UploadedBy = u.UserID
       LEFT JOIN accesslogs al ON b.BookID = al.BookID
       WHERE b.BookID = ?
       GROUP BY b.BookID`,
      [bookId]
    );

    if (!books.length) {
      connection.release();
      return res.status(404).json({ 
        success: false, 
        message: 'Book not found' 
      });
    }

    // Increment view count
    await connection.query(
      'UPDATE ebooks SET ViewCount = ViewCount + 1 WHERE BookID = ?',
      [bookId]
    );

    connection.release();

    res.json({ 
      success: true, 
      data: books[0] 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching book',
      error: error.message 
    });
  }
});

// Create/Upload book (Librarian & Admin only)
app.post('/api/books', authenticateToken, authorize(['Admin', 'Librarian']), async (req, res) => {
  try {
    const { title, author, isbn, categoryId, publisher, publishedDate, description, format, filePath, fileSize } = req.body;

    if (!title || !author || !isbn || !categoryId || !format || !filePath || !fileSize) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }

    const connection = await pool.getConnection();
    
    try {
      const [result] = await connection.query(
        `INSERT INTO ebooks (CategoryID, Title, Author, ISBN, Publisher, PublishedDate, 
                             Description, Format, FilePath, FileSizeMB, UploadedBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [categoryId, title, author, isbn, publisher, publishedDate, description, format, filePath, fileSize, req.user.userId]
      );

      connection.release();

      const bookId = result.insertId;
      await logAuditAction(req.user.userId, 'CREATE', 'EBooks', bookId, { title, author, isbn }, req.ip, 201);

      res.status(201).json({ 
        success: true, 
        message: 'Book uploaded successfully',
        bookId
      });
    } catch (error) {
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Book creation error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ 
        success: false, 
        message: 'ISBN already exists' 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Error uploading book',
      error: error.message 
    });
  }
});

// Update book metadata (Librarian & Admin only)
app.put('/api/books/:bookId', authenticateToken, authorize(['Admin', 'Librarian']), async (req, res) => {
  try {
    const { bookId } = req.params;
    const { title, author, publisher, description, categoryId } = req.body;

    const connection = await pool.getConnection();
    
    try {
      await connection.query(
        `UPDATE ebooks 
         SET Title = COALESCE(?, Title),
             Author = COALESCE(?, Author),
             Publisher = COALESCE(?, Publisher),
             Description = COALESCE(?, Description),
             CategoryID = COALESCE(?, CategoryID),
             LastUpdated = CURRENT_TIMESTAMP
         WHERE BookID = ?`,
        [title, author, publisher, description, categoryId, bookId]
      );

      connection.release();

      await logAuditAction(req.user.userId, 'UPDATE', 'EBooks', bookId, req.body, req.ip, 200);

      res.json({ 
        success: true, 
        message: 'Book updated successfully' 
      });
    } catch (error) {
      connection.release();
      throw error;
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error updating book',
      error: error.message 
    });
  }
});

// Delete/Hide book (Admin only)
app.delete('/api/books/:bookId', authenticateToken, authorize(['Admin']), async (req, res) => {
  try {
    const { bookId } = req.params;

    const connection = await pool.getConnection();
    
    try {
      await connection.query(
        'UPDATE ebooks SET IsAvailable = 0 WHERE BookID = ?',
        [bookId]
      );

      connection.release();

      await logAuditAction(req.user.userId, 'DELETE', 'EBooks', bookId, {}, req.ip, 200);

      res.json({ 
        success: true, 
        message: 'Book deleted' 
      });
    } catch (error) {
      connection.release();
      throw error;
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting book',
      error: error.message 
    });
  }
});

// ===========================
// Team 1: Category Management Routes (FR5)
// ===========================

// Get all categories
app.get('/api/categories', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [categories] = await connection.query(
      `SELECT c.*, COUNT(DISTINCT b.BookID) as BookCount
       FROM categories c
       LEFT JOIN ebooks b ON c.CategoryID = b.CategoryID AND b.IsAvailable = 1
       GROUP BY c.CategoryID
       ORDER BY c.GenreName`
    );
    connection.release();

    res.json({ 
      success: true, 
      data: categories 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching categories',
      error: error.message 
    });
  }
});

// Create category (Admin only)
app.post('/api/categories', authenticateToken, authorize(['Admin']), async (req, res) => {
  try {
    const { genreName, description, parentCategoryId } = req.body;

    if (!genreName) {
      return res.status(400).json({ 
        success: false, 
        message: 'Genre name required' 
      });
    }

    const connection = await pool.getConnection();
    
    try {
      const [result] = await connection.query(
        `INSERT INTO categories (GenreName, Description, ParentCategoryID)
         VALUES (?, ?, ?)`,
        [genreName, description, parentCategoryId]
      );

      connection.release();

      const categoryId = result.insertId;
      await logAuditAction(req.user.userId, 'CREATE', 'Categories', categoryId, { genreName }, req.ip, 201);

      res.status(201).json({ 
        success: true, 
        message: 'Category created',
        categoryId
      });
    } catch (error) {
      connection.release();
      throw error;
    }
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ 
        success: false, 
        message: 'Category already exists' 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Error creating category',
      error: error.message 
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Endpoint not found' 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Team 1: Book & Member Management Module Ready');
});

module.exports = { app, pool, authenticateToken, authorize };
