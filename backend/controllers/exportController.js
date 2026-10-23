const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const logAuditAction = require('../middleware/auditMiddleware');

const REPORTS_DIR = path.resolve(__dirname, '..', 'reports');

if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

/**
 * Escape a value for safe CSV output
 */
function csvEscape(val) {
  if (val == null) return '';
  const str = String(val);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Helper to record report in DB and return response
 */
async function finalizeExport({ req, res, reportType, baseName, extension, content, rawData }) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${baseName}_${timestamp}.${extension}`;
  const filepath = path.join(REPORTS_DIR, filename);

  fs.writeFileSync(filepath, content, 'utf8');

  let reportId = null;
  const connection = await pool.getConnection();
  try {
    const [result] = await connection.query(
      `INSERT INTO reports (GeneratedBy, ReportName, ReportType, FilePath) VALUES (?, ?, ?, ?)`,
      [req.user ? req.user.userId : 1, filename, reportType, filepath]
    );
    reportId = result.insertId;
  } finally {
    connection.release();
  }

  if (req.user && req.user.userId) {
    await logAuditAction(
      req.user.userId,
      'GENERATE_REPORT',
      'Reports',
      reportId,
      { reportType, filename, format: extension, recordsCount: Array.isArray(rawData) ? rawData.length : undefined },
      req.ip,
      200
    );
  }

  return res.json({
    success: true,
    message: `${reportType} exported successfully`,
    filename,
    reportId,
    format: extension,
    recordsCount: Array.isArray(rawData) ? rawData.length : undefined,
    content: extension === 'csv' ? content : undefined,
    data: rawData
  });
}

/**
 * 1. Export Books Catalogue (Admin & Librarian)
 */
exports.exportBooksCatalogue = async (req, res) => {
  try {
    const format = (req.query.format || req.body.format || 'csv').toLowerCase();
    const category = req.query.category || req.body.category;
    
    let query = `
      SELECT e.BookID, e.Title, e.Author, e.ISBN, c.GenreName as Category,
             e.Publisher, e.PublishedDate, e.Format, e.FileSizeMB,
             e.ViewCount, e.UploadDate, e.Description,
             COUNT(DISTINCT al.LogID) as TotalAccesses,
             COUNT(DISTINCT rp.MemberID) as UniqueReaders,
             ROUND(AVG(rp.CompletionPct), 1) as AvgCompletionPct
      FROM ebooks e
      LEFT JOIN categories c ON e.CategoryID = c.CategoryID
      LEFT JOIN accesslogs al ON e.BookID = al.BookID
      LEFT JOIN readingprogress rp ON e.BookID = rp.BookID
      WHERE e.IsAvailable = 1
    `;
    const params = [];
    if (category) {
      query += ` AND (c.GenreName = ? OR e.CategoryID = ?)`;
      params.push(category, category);
    }
    query += ` GROUP BY e.BookID ORDER BY e.Title ASC`;

    const connection = await pool.getConnection();
    const [data] = await connection.query(query, params);
    connection.release();

    if (format === 'json') {
      const jsonContent = JSON.stringify(data, null, 2);
      return finalizeExport({
        req, res,
        reportType: 'Books Catalogue',
        baseName: 'books_catalogue',
        extension: 'json',
        content: jsonContent,
        rawData: data
      });
    }

    const headers = 'Book ID,Title,Author,ISBN,Category,Publisher,Published Date,Format,File Size (MB),View Count,Upload Date,Total Accesses,Unique Readers,Avg Completion %,Description\n';
    const rows = data.map(r =>
      [r.BookID, r.Title, r.Author, r.ISBN, r.Category, r.Publisher,
       r.PublishedDate, r.Format, r.FileSizeMB, r.ViewCount,
       r.UploadDate, r.TotalAccesses, r.UniqueReaders, r.AvgCompletionPct || 0, r.Description]
        .map(csvEscape).join(',')
    ).join('\n');

    return finalizeExport({
      req, res,
      reportType: 'Books Catalogue',
      baseName: 'books_catalogue',
      extension: 'csv',
      content: headers + rows,
      rawData: data
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error exporting books catalogue', error: error.message });
  }
};

/**
 * 2. Export Member Directory (Admin & Librarian)
 */
exports.exportMemberDirectory = async (req, res) => {
  try {
    const format = (req.query.format || req.body.format || 'csv').toLowerCase();
    const tier = req.query.tier || req.body.tier;

    let query = `
      SELECT mp.MemberID, u.UserID, u.Username, u.Email, mp.FullName, mp.Department,
             mp.SubscriptionTier, mp.RegistrationDate, mp.LastActiveDate,
             u.IsActive, mp.PhoneNumber, mp.EnrollmentYear,
             COUNT(DISTINCT rp.BookID) as BooksRead,
             ROUND(AVG(rp.CompletionPct), 1) as AvgCompletionPct
      FROM memberprofiles mp
      JOIN users u ON mp.UserID = u.UserID
      LEFT JOIN readingprogress rp ON mp.MemberID = rp.MemberID
      WHERE 1=1
    `;
    const params = [];
    if (tier) {
      query += ` AND mp.SubscriptionTier = ?`;
      params.push(tier);
    }
    query += ` GROUP BY mp.MemberID ORDER BY mp.RegistrationDate DESC`;

    const connection = await pool.getConnection();
    const [data] = await connection.query(query, params);
    connection.release();

    if (format === 'json') {
      const jsonContent = JSON.stringify(data, null, 2);
      return finalizeExport({
        req, res,
        reportType: 'Member Directory',
        baseName: 'member_directory',
        extension: 'json',
        content: jsonContent,
        rawData: data
      });
    }

    const headers = 'Member ID,User ID,Username,Email,Full Name,Department,Subscription Tier,Registration Date,Last Active,Status,Phone Number,Enrollment Year,Books Read,Avg Completion %\n';
    const rows = data.map(r =>
      [r.MemberID, r.UserID, r.Username, r.Email, r.FullName, r.Department,
       r.SubscriptionTier, r.RegistrationDate, r.LastActiveDate,
       r.IsActive ? 'Active' : 'Inactive', r.PhoneNumber, r.EnrollmentYear,
       r.BooksRead, r.AvgCompletionPct || 0]
        .map(csvEscape).join(',')
    ).join('\n');

    return finalizeExport({
      req, res,
      reportType: 'Member Directory',
      baseName: 'member_directory',
      extension: 'csv',
      content: headers + rows,
      rawData: data
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error exporting member directory', error: error.message });
  }
};

/**
 * 3. Export System Audit Trail Logs (Admin only)
 */
exports.exportAuditLogs = async (req, res) => {
  try {
    const format = (req.query.format || req.body.format || 'csv').toLowerCase();
    const { startDate, endDate, actionType, userId } = req.query;

    let query = `
      SELECT al.AuditID, al.Timestamp, u.Username, al.UserID, al.ActionType,
             al.ResourceType, al.ResourceID, al.ActionDetails, al.IPAddress, al.StatusCode
      FROM auditlogs al
      LEFT JOIN users u ON al.UserID = u.UserID
      WHERE 1=1
    `;
    const params = [];
    if (startDate) {
      query += ` AND al.Timestamp >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND al.Timestamp <= ?`;
      params.push(endDate);
    }
    if (actionType) {
      query += ` AND al.ActionType = ?`;
      params.push(actionType);
    }
    if (userId) {
      query += ` AND al.UserID = ?`;
      params.push(userId);
    }
    query += ` ORDER BY al.Timestamp DESC LIMIT 5000`;

    const connection = await pool.getConnection();
    const [data] = await connection.query(query, params);
    connection.release();

    if (format === 'json') {
      const jsonContent = JSON.stringify(data, null, 2);
      return finalizeExport({
        req, res,
        reportType: 'Audit Logs',
        baseName: 'audit_logs',
        extension: 'json',
        content: jsonContent,
        rawData: data
      });
    }

    const headers = 'Audit ID,Timestamp,Username,User ID,Action Type,Resource Type,Resource ID,Action Details,IP Address,Status Code\n';
    const rows = data.map(r =>
      [r.AuditID, r.Timestamp, r.Username || 'System', r.UserID, r.ActionType,
       r.ResourceType, r.ResourceID, r.ActionDetails, r.IPAddress, r.StatusCode]
        .map(csvEscape).join(',')
    ).join('\n');

    return finalizeExport({
      req, res,
      reportType: 'Audit Logs',
      baseName: 'audit_logs',
      extension: 'csv',
      content: headers + rows,
      rawData: data
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error exporting audit logs', error: error.message });
  }
};

/**
 * 4. Export Access & Circulation Logs (Admin & Librarian)
 */
exports.exportAccessLogs = async (req, res) => {
  try {
    const format = (req.query.format || req.body.format || 'csv').toLowerCase();
    const { startDate, endDate, bookId } = req.query;

    let query = `
      SELECT al.LogID, al.AccessTimestamp, al.MemberID, mp.FullName as MemberName,
             u.Email as MemberEmail, al.BookID, e.Title as BookTitle, e.Author as BookAuthor,
             al.IPAddress, al.DeviceType, al.SessionDuration
      FROM accesslogs al
      LEFT JOIN memberprofiles mp ON al.MemberID = mp.MemberID
      LEFT JOIN users u ON mp.UserID = u.UserID
      LEFT JOIN ebooks e ON al.BookID = e.BookID
      WHERE 1=1
    `;
    const params = [];
    if (startDate) {
      query += ` AND al.AccessTimestamp >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND al.AccessTimestamp <= ?`;
      params.push(endDate);
    }
    if (bookId) {
      query += ` AND al.BookID = ?`;
      params.push(bookId);
    }
    query += ` ORDER BY al.AccessTimestamp DESC LIMIT 5000`;

    const connection = await pool.getConnection();
    const [data] = await connection.query(query, params);
    connection.release();

    if (format === 'json') {
      const jsonContent = JSON.stringify(data, null, 2);
      return finalizeExport({
        req, res,
        reportType: 'Access Logs',
        baseName: 'access_circulation_logs',
        extension: 'json',
        content: jsonContent,
        rawData: data
      });
    }

    const headers = 'Log ID,Access Timestamp,Member ID,Member Name,Member Email,Book ID,Book Title,Book Author,IP Address,Device Type,Session Duration (mins)\n';
    const rows = data.map(r =>
      [r.LogID, r.AccessTimestamp, r.MemberID, r.MemberName, r.MemberEmail,
       r.BookID, r.BookTitle, r.BookAuthor, r.IPAddress, r.DeviceType, r.SessionDuration]
        .map(csvEscape).join(',')
    ).join('\n');

    return finalizeExport({
      req, res,
      reportType: 'Access Logs',
      baseName: 'access_circulation_logs',
      extension: 'csv',
      content: headers + rows,
      rawData: data
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error exporting access logs', error: error.message });
  }
};

/**
 * 5. Export Reading Analytics & Progress Report (Admin & Librarian)
 */
exports.exportReadingAnalytics = async (req, res) => {
  try {
    const format = (req.query.format || req.body.format || 'csv').toLowerCase();

    const connection = await pool.getConnection();
    const [data] = await connection.query(
      `SELECT e.BookID, e.Title, e.Author, c.GenreName as Category,
              COUNT(DISTINCT al.LogID) as TotalAccesses,
              COUNT(DISTINCT rp.MemberID) as UniqueReaders,
              ROUND(AVG(rp.CompletionPct), 1) as AvgCompletionPct,
              MAX(rp.LastAccessed) as LatestReadDate,
              e.ViewCount
       FROM ebooks e
       LEFT JOIN categories c ON e.CategoryID = c.CategoryID
       LEFT JOIN accesslogs al ON e.BookID = al.BookID
       LEFT JOIN readingprogress rp ON e.BookID = rp.BookID
       WHERE e.IsAvailable = 1
       GROUP BY e.BookID
       ORDER BY TotalAccesses DESC`
    );
    connection.release();

    if (format === 'json') {
      const jsonContent = JSON.stringify(data, null, 2);
      return finalizeExport({
        req, res,
        reportType: 'Reading Analytics',
        baseName: 'reading_analytics',
        extension: 'json',
        content: jsonContent,
        rawData: data
      });
    }

    const headers = 'Book ID,Title,Author,Category,Total Accesses,Unique Readers,Avg Completion %,Latest Read Date,View Count\n';
    const rows = data.map(r =>
      [r.BookID, r.Title, r.Author, r.Category || 'Uncategorized',
       r.TotalAccesses, r.UniqueReaders, r.AvgCompletionPct || 0, r.LatestReadDate, r.ViewCount]
        .map(csvEscape).join(',')
    ).join('\n');

    return finalizeExport({
      req, res,
      reportType: 'Reading Analytics',
      baseName: 'reading_analytics',
      extension: 'csv',
      content: headers + rows,
      rawData: data
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error exporting reading analytics', error: error.message });
  }
};

/**
 * 6. Export Search History & Query Trends (Admin only)
 */
exports.exportSearchHistory = async (req, res) => {
  try {
    const format = (req.query.format || req.body.format || 'csv').toLowerCase();

    const connection = await pool.getConnection();
    const [data] = await connection.query(
      `SELECT sh.SearchID, sh.CreatedAt as SearchTimestamp, u.Username,
              mp.FullName as MemberName, sh.SearchQuery, sh.CategoryFilter,
              sh.ResultsCount
       FROM searchhistory sh
       LEFT JOIN users u ON sh.UserID = u.UserID
       LEFT JOIN memberprofiles mp ON sh.MemberID = mp.MemberID
       ORDER BY sh.CreatedAt DESC
       LIMIT 5000`
    );
    connection.release();

    if (format === 'json') {
      const jsonContent = JSON.stringify(data, null, 2);
      return finalizeExport({
        req, res,
        reportType: 'Search History',
        baseName: 'search_history',
        extension: 'json',
        content: jsonContent,
        rawData: data
      });
    }

    const headers = 'Search ID,Timestamp,Username,Member Name,Search Query,Category Filter,Results Count\n';
    const rows = data.map(r =>
      [r.SearchID, r.SearchTimestamp, r.Username || 'Anonymous', r.MemberName || 'N/A',
       r.SearchQuery, r.CategoryFilter || 'All', r.ResultsCount]
        .map(csvEscape).join(',')
    ).join('\n');

    return finalizeExport({
      req, res,
      reportType: 'Search History',
      baseName: 'search_history',
      extension: 'csv',
      content: headers + rows,
      rawData: data
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error exporting search history', error: error.message });
  }
};

/**
 * 7. Export Notifications Log (Admin only)
 */
exports.exportNotifications = async (req, res) => {
  try {
    const format = (req.query.format || req.body.format || 'csv').toLowerCase();

    const connection = await pool.getConnection();
    const [data] = await connection.query(
      `SELECT n.NotificationID, mp.FullName, u.Username, u.Email, n.Message, n.NotificationType,
              n.IsRead, n.SentDate
       FROM notifications n
       LEFT JOIN memberprofiles mp ON n.MemberID = mp.MemberID
       LEFT JOIN users u ON mp.UserID = u.UserID
       ORDER BY n.SentDate DESC
       LIMIT 2000`
    );
    connection.release();

    if (format === 'json') {
      const jsonContent = JSON.stringify(data, null, 2);
      return finalizeExport({
        req, res,
        reportType: 'Notifications Log',
        baseName: 'notifications_log',
        extension: 'json',
        content: jsonContent,
        rawData: data
      });
    }

    const headers = 'Notification ID,Full Name,Username,Email,Message,Type,Is Read,Sent Date\n';
    const rows = data.map(r =>
      [r.NotificationID, r.FullName || 'Member', r.Username || 'N/A', r.Email || 'N/A',
       r.Message, r.NotificationType, r.IsRead ? 'Yes' : 'No', r.SentDate]
        .map(csvEscape).join(',')
    ).join('\n');

    return finalizeExport({
      req, res,
      reportType: 'Notifications Log',
      baseName: 'notifications_log',
      extension: 'csv',
      content: headers + rows,
      rawData: data
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error exporting notifications', error: error.message });
  }
};

/**
 * 8. Export Full System Summary (Executive Report) (Admin only)
 */
exports.exportSystemSummary = async (req, res) => {
  try {
    const format = (req.query.format || req.body.format || 'csv').toLowerCase();
    const connection = await pool.getConnection();

    const [books] = await connection.query('SELECT COUNT(*) as total FROM ebooks WHERE IsAvailable = 1');
    const [members] = await connection.query('SELECT COUNT(*) as total FROM memberprofiles');
    const [users] = await connection.query('SELECT COUNT(*) as total FROM users WHERE IsActive = 1');
    const [premium] = await connection.query("SELECT COUNT(*) as total FROM memberprofiles WHERE SubscriptionTier = 'Premium'");
    const [categories] = await connection.query('SELECT COUNT(*) as total FROM categories');
    const [auditLogs] = await connection.query('SELECT COUNT(*) as total FROM auditlogs');
    const [todayLogs] = await connection.query('SELECT COUNT(*) as total FROM auditlogs WHERE DATE(Timestamp) = CURDATE()');
    const [reports] = await connection.query('SELECT COUNT(*) as total FROM reports');
    const [accesses] = await connection.query('SELECT COUNT(*) as total FROM accesslogs');
    const [todaySessions] = await connection.query('SELECT COUNT(*) as total FROM accesslogs WHERE DATE(AccessTimestamp) = CURDATE()');
    const [searches] = await connection.query('SELECT COUNT(*) as total FROM searchhistory');

    const [topBooks] = await connection.query(
      `SELECT e.Title, COUNT(al.LogID) as AccessCount
       FROM ebooks e
       LEFT JOIN accesslogs al ON e.BookID = al.BookID
       WHERE e.IsAvailable = 1
       GROUP BY e.BookID
       ORDER BY AccessCount DESC
       LIMIT 10`
    );

    const [topCategories] = await connection.query(
      `SELECT c.GenreName, COUNT(e.BookID) as BookCount
       FROM categories c
       LEFT JOIN ebooks e ON c.CategoryID = e.CategoryID AND e.IsAvailable = 1
       GROUP BY c.CategoryID
       ORDER BY BookCount DESC`
    );

    connection.release();

    const summaryData = {
      generatedAt: new Date().toISOString(),
      overview: {
        totalBooks: books[0].total,
        totalMembers: members[0].total,
        activeUsers: users[0].total,
        premiumMembers: premium[0].total,
        categories: categories[0].total,
        totalAuditLogs: auditLogs[0].total,
        todayAuditEvents: todayLogs[0].total,
        generatedReports: reports[0].total,
        totalAccesses: accesses[0].total,
        todaySessions: todaySessions[0].total,
        totalSearches: searches[0].total
      },
      topAccessedBooks: topBooks,
      categoryDistribution: topCategories
    };

    if (format === 'json') {
      const jsonContent = JSON.stringify(summaryData, null, 2);
      return finalizeExport({
        req, res,
        reportType: 'System Summary',
        baseName: 'system_summary',
        extension: 'json',
        content: jsonContent,
        rawData: summaryData
      });
    }

    let csv = 'DIGITAL LIBRARY SYSTEM — EXECUTIVE SUMMARY REPORT\n';
    csv += `Generated At,${new Date().toISOString()}\n\n`;
    csv += 'KEY OPERATIONAL METRICS\n';
    csv += 'Metric,Value\n';
    csv += `Total Available Books,${books[0].total}\n`;
    csv += `Registered Members,${members[0].total}\n`;
    csv += `Active Users,${users[0].total}\n`;
    csv += `Premium Subscription Members,${premium[0].total}\n`;
    csv += `Categories & Genres,${categories[0].total}\n`;
    csv += `Total System Audit Logs,${auditLogs[0].total}\n`;
    csv += `Today's Audit Events,${todayLogs[0].total}\n`;
    csv += `Reports Generated,${reports[0].total}\n`;
    csv += `Total Book Accesses,${accesses[0].total}\n`;
    csv += `Today's Active Sessions,${todaySessions[0].total}\n`;
    csv += `Total Search Queries Recorded,${searches[0].total}\n\n`;

    csv += 'TOP ACCESSED BOOKS\n';
    csv += 'Title,Access Count\n';
    topBooks.forEach(b => {
      csv += `${csvEscape(b.Title)},${b.AccessCount}\n`;
    });

    csv += '\nCATEGORY DISTRIBUTION\n';
    csv += 'Category,Book Count\n';
    topCategories.forEach(c => {
      csv += `${csvEscape(c.GenreName)},${c.BookCount}\n`;
    });

    return finalizeExport({
      req, res,
      reportType: 'System Summary',
      baseName: 'system_summary',
      extension: 'csv',
      content: csv,
      rawData: summaryData
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error exporting system summary', error: error.message });
  }
};

/**
 * 9. Export Payment & Subscription Transactions (Admin & Librarian)
 */
exports.exportPaymentTransactions = async (req, res) => {
  try {
    const format = (req.query.format || req.body.format || 'csv').toLowerCase();
    const { status, startDate, endDate } = req.query;

    let query = `
      SELECT pt.TransactionID, pt.UserID, u.Username, mp.FullName, u.Email,
             pt.RazorpayOrderID, pt.RazorpayPaymentID, pt.PlanName, pt.Amount,
             pt.Currency, pt.PaymentStatus, pt.PaymentMethod, pt.StartDate,
             pt.EndDate, pt.CreatedAt
      FROM payment_transactions pt
      LEFT JOIN users u ON pt.UserID = u.UserID
      LEFT JOIN memberprofiles mp ON pt.MemberID = mp.MemberID
      WHERE 1=1
    `;
    const params = [];
    if (status) {
      query += ` AND pt.PaymentStatus = ?`;
      params.push(status);
    }
    if (startDate) {
      query += ` AND pt.CreatedAt >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND pt.CreatedAt <= ?`;
      params.push(endDate);
    }
    query += ` ORDER BY pt.CreatedAt DESC LIMIT 5000`;

    const connection = await pool.getConnection();
    const [data] = await connection.query(query, params);
    connection.release();

    if (format === 'json') {
      const jsonContent = JSON.stringify(data, null, 2);
      return finalizeExport({
        req, res,
        reportType: 'Payment Transactions',
        baseName: 'payment_transactions',
        extension: 'json',
        content: jsonContent,
        rawData: data
      });
    }

    const headers = 'Transaction ID,User ID,Username,Full Name,Email,Razorpay Order ID,Razorpay Payment ID,Plan Name,Amount,Currency,Status,Payment Method,Start Date,End Date,Created At\n';
    const rows = data.map(r =>
      [r.TransactionID, r.UserID, r.Username || 'N/A', r.FullName || 'Member', r.Email || 'N/A',
       r.RazorpayOrderID, r.RazorpayPaymentID || 'PENDING', r.PlanName, r.Amount, r.Currency,
       r.PaymentStatus, r.PaymentMethod, r.StartDate, r.EndDate, r.CreatedAt]
        .map(csvEscape).join(',')
    ).join('\n');

    return finalizeExport({
      req, res,
      reportType: 'Payment Transactions',
      baseName: 'payment_transactions',
      extension: 'csv',
      content: headers + rows,
      rawData: data
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error exporting payment transactions', error: error.message });
  }
};

/**
 * 10. Download Export File Directly
 */
exports.downloadExportFile = async (req, res) => {
  try {
    const { filename } = req.params;
    // Prevent path traversal
    const safeFilename = path.basename(filename);
    const filepath = path.join(REPORTS_DIR, safeFilename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ success: false, message: 'Export file not found' });
    }

    const ext = path.extname(safeFilename).toLowerCase();
    const contentType = ext === '.json' ? 'application/json' : 'text/csv';

    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Content-Type', contentType);
    fs.createReadStream(filepath).pipe(res);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error downloading export file', error: error.message });
  }
};
