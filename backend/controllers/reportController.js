const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const logAuditAction = require('../middleware/auditMiddleware');

const REPORTS_DIR = path.resolve(__dirname, '..', 'reports');

// Ensure reports directory exists
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

/**
 * Generate a reading analytics report (CSV)
 */
exports.generateReadingReport = async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const [data] = await connection.query(
      `SELECT e.Title, e.Author, c.GenreName,
              COUNT(DISTINCT al.LogID) as TotalAccesses,
              COUNT(DISTINCT rp.MemberID) as UniqueReaders,
              AVG(rp.CompletionPct) as AvgCompletion,
              e.ViewCount
       FROM ebooks e
       LEFT JOIN categories c ON e.CategoryID = c.CategoryID
       LEFT JOIN accesslogs al ON e.BookID = al.BookID
       LEFT JOIN readingprogress rp ON e.BookID = rp.BookID
       WHERE e.IsAvailable = 1
       GROUP BY e.BookID
       ORDER BY TotalAccesses DESC`
    );

    // Generate CSV
    const headers = 'Title,Author,Genre,Total Accesses,Unique Readers,Avg Completion %,View Count\n';
    const rows = data.map(r =>
      `"${r.Title}","${r.Author}","${r.GenreName || 'N/A'}",${r.TotalAccesses},${r.UniqueReaders},${(r.AvgCompletion || 0).toFixed(1)},${r.ViewCount}`
    ).join('\n');

    const csv = headers + rows;
    const filename = `reading_report_${new Date().toISOString().split('T')[0]}.csv`;
    const filepath = path.join(REPORTS_DIR, filename);
    fs.writeFileSync(filepath, csv);

    // Save report record
    await connection.query(
      `INSERT INTO reports (GeneratedBy, ReportName, ReportType, FilePath)
       VALUES (?, ?, 'Reading Analytics', ?)`,
      [req.user.userId, filename, filepath]
    );
    connection.release();

    await logAuditAction(req.user.userId, 'GENERATE_REPORT', 'Reports', null, { reportType: 'Reading Analytics' }, req.ip, 201);

    res.json({
      success: true,
      message: 'Reading report generated',
      filename,
      data
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

/**
 * Generate an audit summary report (CSV)
 */
exports.generateAuditReport = async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const [data] = await connection.query(
      `SELECT al.Timestamp, u.Username, al.ActionType, al.ResourceType,
              al.IPAddress, al.StatusCode
       FROM auditlogs al
       LEFT JOIN users u ON al.UserID = u.UserID
       ORDER BY al.Timestamp DESC
       LIMIT 1000`
    );

    // Generate CSV
    const headers = 'Timestamp,Username,Action,Resource,IP Address,Status Code\n';
    const rows = data.map(r =>
      `"${r.Timestamp}","${r.Username || 'System'}","${r.ActionType}","${r.ResourceType || 'N/A'}","${r.IPAddress}",${r.StatusCode || 'N/A'}`
    ).join('\n');

    const csv = headers + rows;
    const filename = `audit_report_${new Date().toISOString().split('T')[0]}.csv`;
    const filepath = path.join(REPORTS_DIR, filename);
    fs.writeFileSync(filepath, csv);

    await connection.query(
      `INSERT INTO reports (GeneratedBy, ReportName, ReportType, FilePath)
       VALUES (?, ?, 'Audit Summary', ?)`,
      [req.user.userId, filename, filepath]
    );
    connection.release();

    await logAuditAction(req.user.userId, 'GENERATE_REPORT', 'Reports', null, { reportType: 'Audit Summary' }, req.ip, 201);

    res.json({
      success: true,
      message: 'Audit report generated',
      filename,
      data
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

/**
 * List all generated reports
 */
exports.getReportsList = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [reports] = await connection.query(
      `SELECT r.*, u.Username as GeneratedByName
       FROM reports r
       LEFT JOIN users u ON r.GeneratedBy = u.UserID
       ORDER BY r.GenerationDate DESC`
    );
    connection.release();

    res.json({ success: true, data: reports });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching reports', error: error.message });
  }
};

/**
 * Download a report file
 */
exports.downloadReport = async (req, res) => {
  try {
    const { reportId } = req.params;

    const connection = await pool.getConnection();
    const [reports] = await connection.query(
      'SELECT * FROM reports WHERE ReportID = ?',
      [reportId]
    );
    connection.release();

    if (!reports.length) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const report = reports[0];
    if (!fs.existsSync(report.FilePath)) {
      return res.status(404).json({ success: false, message: 'Report file not found on disk' });
    }

    res.download(report.FilePath, report.ReportName);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error downloading report', error: error.message });
  }
};
