/**
 * recommendationController.js — Controller for Machine Learning Recommendations
 *
 * Provides endpoints to:
 * 1. Generate personalized book recommendations based on searches and recent reads.
 * 2. Track user search queries to train/update user profile vectors.
 * 3. Inspect and retrain the ML recommendation model.
 */

const pool = require('../config/db');
const recommendationModel = require('../ml/recommendationModel');

/**
 * Helper to ensure model is trained with latest available books
 */
async function ensureModelTrained() {
  if (recommendationModel.isTrained) return;

  try {
    const connection = await pool.getConnection();
    const [books] = await connection.query(`
      SELECT b.BookID, b.CategoryID, b.Title, b.Author, b.ISBN, b.Publisher,
             b.Description, b.Format, b.FilePath, b.CoverImagePath, b.ViewCount,
             c.GenreName
      FROM ebooks b
      LEFT JOIN categories c ON b.CategoryID = c.CategoryID
      WHERE b.IsAvailable = 1
    `);
    connection.release();

    recommendationModel.fit(books);
  } catch (error) {
    console.error('[ML Controller] Error initializing recommendation model:', error);
  }
}

// Initialize on server load
ensureModelTrained();

/**
 * Get personalized recommendations for user
 * Supports both authenticated users (DB signals) and guest/client users (query params)
 */
exports.getRecommendations = async (req, res) => {
  try {
    await ensureModelTrained();

    const limit = parseInt(req.query.limit, 10) || 6;
    let searches = [];
    let recentReads = [];

    // 1. Fetch authenticated user data from database if available
    if (req.user && req.user.userId) {
      const connection = await pool.getConnection();

      try {
        // Find MemberID
        const [members] = await connection.query(
          'SELECT MemberID FROM memberprofiles WHERE UserID = ?',
          [req.user.userId]
        );
        const memberId = members.length ? members[0].MemberID : null;

        // Fetch recent reading progress
        if (memberId) {
          const [progress] = await connection.query(
            `SELECT rp.BookID, rp.LastAccessed, rp.CompletionPct
             FROM readingprogress rp
             WHERE rp.MemberID = ?
             ORDER BY rp.LastAccessed DESC
             LIMIT 10`,
            [memberId]
          );
          recentReads = progress.map(p => ({
            bookId: p.BookID,
            lastAccessed: p.LastAccessed,
            completionPct: parseFloat(p.CompletionPct) || 0
          }));
        }

        // Fetch search history
        const [history] = await connection.query(
          `SELECT SearchQuery, CreatedAt
           FROM searchhistory
           WHERE UserID = ? OR MemberID = ?
           ORDER BY CreatedAt DESC
           LIMIT 15`,
          [req.user.userId, memberId || 0]
        );
        searches = history.map(h => ({
          query: h.SearchQuery,
          timestamp: h.CreatedAt
        }));

        connection.release();
      } catch (dbErr) {
        connection.release();
        console.warn('[ML Controller] Database query warning:', dbErr.message);
      }
    }

    // 2. Client fallback / supplemental signals (from query parameters or localStorage)
    if (req.query.searches) {
      try {
        const clientSearches = typeof req.query.searches === 'string'
          ? (req.query.searches.startsWith('[') ? JSON.parse(req.query.searches) : req.query.searches.split(',').map(s => ({ query: s.trim() })))
          : [];
        searches = [...searches, ...clientSearches];
      } catch (e) {}
    }

    if (req.query.recentReads) {
      try {
        const clientReads = typeof req.query.recentReads === 'string'
          ? (req.query.recentReads.startsWith('[') ? JSON.parse(req.query.recentReads) : req.query.recentReads.split(',').map(id => ({ bookId: parseInt(id.trim(), 10) })))
          : [];
        recentReads = [...recentReads, ...clientReads];
      } catch (e) {}
    }

    // 3. Run Machine Learning Inference
    const recommendations = recommendationModel.predict({
      searches,
      recentReads,
      limit,
      excludeRead: true
    });

    res.json({
      success: true,
      modelInfo: recommendationModel.getInfo(),
      signalsUsed: {
        searchesCount: searches.length,
        recentReadsCount: recentReads.length
      },
      data: recommendations
    });
  } catch (error) {
    console.error('[ML Controller] Error generating recommendations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate recommendations',
      error: error.message
    });
  }
};

/**
 * Record a search query to enrich user's ML preference vector
 */
exports.trackSearch = async (req, res) => {
  try {
    const { query, categoryId = null, resultsCount = 0 } = req.body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ success: false, message: 'Valid search query required' });
    }

    const cleanQuery = query.trim().slice(0, 255);
    const userId = req.user ? req.user.userId : null;

    if (userId) {
      const connection = await pool.getConnection();
      try {
        const [members] = await connection.query(
          'SELECT MemberID FROM memberprofiles WHERE UserID = ?',
          [userId]
        );
        const memberId = members.length ? members[0].MemberID : null;

        await connection.query(
          `INSERT INTO searchhistory (UserID, MemberID, SearchQuery, CategoryFilter, ResultsCount)
           VALUES (?, ?, ?, ?, ?)`,
          [userId, memberId, cleanQuery, categoryId || null, parseInt(resultsCount, 10) || 0]
        );

        connection.release();
      } catch (err) {
        connection.release();
        throw err;
      }
    }

    res.json({
      success: true,
      message: 'Search query tracked for recommendations',
      query: cleanQuery
    });
  } catch (error) {
    console.error('[ML Controller] Track search error:', error);
    res.status(500).json({
      success: false,
      message: 'Error tracking search',
      error: error.message
    });
  }
};

/**
 * Get ML Model Information and Vocabulary Stats
 */
exports.getModelInfo = (req, res) => {
  res.json({
    success: true,
    data: recommendationModel.getInfo()
  });
};

/**
 * Retrain or update the ML model with latest database catalogue
 */
exports.retrainModel = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [books] = await connection.query(`
      SELECT b.BookID, b.CategoryID, b.Title, b.Author, b.ISBN, b.Publisher,
             b.Description, b.Format, b.FilePath, b.CoverImagePath, b.ViewCount,
             c.GenreName
      FROM ebooks b
      LEFT JOIN categories c ON b.CategoryID = c.CategoryID
      WHERE b.IsAvailable = 1
    `);
    connection.release();

    recommendationModel.fit(books);

    res.json({
      success: true,
      message: 'Recommendation ML model retrained successfully',
      data: recommendationModel.getInfo()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrain ML model',
      error: error.message
    });
  }
};
