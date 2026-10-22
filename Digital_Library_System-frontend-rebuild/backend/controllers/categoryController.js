const pool = require('../config/db');
const logAuditAction = require('../middleware/auditMiddleware');

exports.getAllCategories = async (req, res) => {
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
};

exports.createCategory = async (req, res) => {
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
};
