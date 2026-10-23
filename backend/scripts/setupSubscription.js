/**
 * setupSubscription.js — Database setup for exclusive content & subscription payment gateway
 */
const pool = require('../config/db');

async function setupSubscriptionSchema() {
  const connection = await pool.getConnection();
  try {
    console.log('[Subscription] Ensuring schema is up to date...');

    // 1. Add IsExclusive to ebooks if not exists
    const [cols] = await connection.query("SHOW COLUMNS FROM ebooks LIKE 'IsExclusive'");
    if (!cols.length) {
      await connection.query("ALTER TABLE ebooks ADD COLUMN IsExclusive TINYINT(1) DEFAULT 0 AFTER IsAvailable");
      console.log('[Subscription] Added IsExclusive column to ebooks.');
    }

    // 2. Mark exclusive books
    const exclusiveTitles = [
      'Captain Blood',
      'The Colors Of Space',
      "Out Of Time's Abyss",
      'The Metal Monster',
      'The South Pole',
      'The White Company'
    ];
    await connection.query(
      "UPDATE ebooks SET IsExclusive = 1 WHERE Title IN (?)",
      [exclusiveTitles]
    );
    console.log(`[Subscription] Marked exclusive titles: ${exclusiveTitles.join(', ')}`);

    // 3. Create payment_transactions table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS payment_transactions (
        TransactionID INT AUTO_INCREMENT PRIMARY KEY,
        UserID INT NOT NULL,
        MemberID INT NULL,
        RazorpayOrderID VARCHAR(100) NOT NULL,
        RazorpayPaymentID VARCHAR(100) NULL,
        RazorpaySignature VARCHAR(255) NULL,
        PlanName VARCHAR(50) NOT NULL,
        Amount DECIMAL(10,2) NOT NULL,
        Currency VARCHAR(10) DEFAULT 'INR',
        PaymentStatus ENUM('PENDING', 'SUCCESS', 'FAILED') DEFAULT 'PENDING',
        PaymentMethod VARCHAR(50) DEFAULT 'razorpay',
        StartDate DATETIME NULL,
        EndDate DATETIME NULL,
        CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (UserID),
        INDEX idx_member_id (MemberID),
        INDEX idx_order_id (RazorpayOrderID),
        INDEX idx_payment_id (RazorpayPaymentID),
        INDEX idx_status (PaymentStatus)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('[Subscription] Verified payment_transactions table.');

    // 4. Seed sample transactions if empty so Admin & Librarian have initial logs
    const [txCount] = await connection.query("SELECT COUNT(*) as count FROM payment_transactions");
    if (txCount[0].count === 0) {
      // Find Aarav Mehta or first member
      const [members] = await connection.query(
        "SELECT mp.MemberID, mp.UserID, u.Username FROM memberprofiles mp JOIN users u ON mp.UserID = u.UserID WHERE mp.SubscriptionTier = 'Premium' LIMIT 3"
      );
      if (members.length) {
        for (const m of members) {
          const now = new Date();
          const nextMonth = new Date(Date.now() + 30 * 86400000);
          await connection.query(`
            INSERT INTO payment_transactions 
              (UserID, MemberID, RazorpayOrderID, RazorpayPaymentID, RazorpaySignature, PlanName, Amount, Currency, PaymentStatus, PaymentMethod, StartDate, EndDate)
            VALUES 
              (?, ?, ?, ?, ?, 'Monthly Premium', 299.00, 'INR', 'SUCCESS', 'razorpay_upi', ?, ?)
          `, [
            m.UserID,
            m.MemberID,
            `order_${Math.random().toString(36).substring(2, 11)}`,
            `pay_${Math.random().toString(36).substring(2, 11)}`,
            'sample_sig_seed',
            now,
            nextMonth
          ]);
        }
        console.log(`[Subscription] Seeded initial subscription payment logs.`);
      }
    }

    console.log('[Subscription] Setup complete.');
  } catch (error) {
    console.error('[Subscription] Setup error:', error.message);
  } finally {
    connection.release();
  }
}

// Allow direct run
if (require.main === module) {
  setupSubscriptionSchema()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = setupSubscriptionSchema;
