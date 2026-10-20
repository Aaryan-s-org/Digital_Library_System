const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Import routes
const authRoutes = require('./routes/authRoutes');
const memberRoutes = require('./routes/memberRoutes');
const userRoutes = require('./routes/userRoutes');
const bookRoutes = require('./routes/bookRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const readerRoutes = require('./routes/readerRoutes');
const progressRoutes = require('./routes/progressRoutes');
const bookmarkRoutes = require('./routes/bookmarkRoutes');
const reportRoutes = require('./routes/reportRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const auditRoutes = require('./routes/auditRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');

// ===========================
// Middleware
// ===========================
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// Serve cover images
app.use('/assets/covers', express.static(path.join(__dirname, '../frontend/assets/covers')));

// ===========================
// Routes
// ===========================
app.use('/api/auth', authRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/users', userRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/reader', readerRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/recommendations', recommendationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// SPA fallback — serve index.html for any non-API route
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  // Check if the requested file exists in the frontend directory
  const filePath = path.join(__dirname, '../frontend', req.path);
  const fs = require('fs');
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return res.sendFile(filePath);
  }
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// 404 handler for API routes
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Endpoint not found' 
  });
});

// ===========================
// Auto-seed ebooks on startup
// ===========================
async function startServer() {
  // Wait a moment for DB to be fully ready
  const pool = require('./config/db');

  if (process.env.SEED_ON_START === 'true') {
    console.log('[Startup] SEED_ON_START is enabled. Waiting for DB...');
    
    // Retry DB connection
    let retries = 10;
    while (retries > 0) {
      try {
        const conn = await pool.getConnection();
        await conn.query('SELECT 1');
        conn.release();
        console.log('[Startup] Database connection verified.');
        break;
      } catch (err) {
        retries--;
        if (retries === 0) {
          console.error('[Startup] Could not connect to database after retries. Skipping seed.');
          break;
        }
        console.log(`[Startup] DB not ready, retrying in 3s... (${retries} retries left)`);
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    if (retries > 0) {
      try {
        const seedEbooks = require('./scripts/seedEbooks');
        await seedEbooks();
      } catch (err) {
        console.error('[Startup] Seed error (non-fatal):', err.message);
      }
    }
  }

  // Start server
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Digital Library Portal — All modules ready');
    console.log(`  Frontend: http://localhost:${PORT}`);
    console.log(`  API:      http://localhost:${PORT}/api`);
  });
}

startServer();

const pool = require('./config/db');
const { authenticateToken, authorize } = require('./middleware/authMiddleware');

module.exports = { app, pool, authenticateToken, authorize };
