const crypto = require('crypto');
const pool = require('../config/db');
const logAuditAction = require('../middleware/auditMiddleware');

function getRazorpayClient() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (key_id && key_secret && !key_id.includes('your_') && !key_id.includes('demo')) {
    try {
      const Razorpay = require('razorpay');
      return new Razorpay({ key_id, key_secret });
    } catch (e) {
      console.warn('[Payments] Razorpay SDK initialization error:', e.message);
      return null;
    }
  }
  return null;
}

const SUBSCRIPTION_PLANS = {
  premium_monthly: {
    id: 'premium_monthly',
    name: 'Premium Monthly',
    amount: 299, // in INR
    durationDays: 30,
    description: 'Instant full access to all exclusive titles & unlimited reading'
  },
  premium_annual: {
    id: 'premium_annual',
    name: 'Premium Annual VIP',
    amount: 2499, // in INR
    durationDays: 365,
    description: 'Year-round exclusive access with priority reading perks & saving 30%'
  }
};

/**
 * Get Razorpay public configuration & available subscription tiers
 */
exports.getConfig = (req, res) => {
  const keyId = process.env.RAZORPAY_KEY_ID || '';
  const isTestKey = Boolean(keyId && keyId.startsWith('rzp_test_') && !keyId.includes('your_') && !keyId.includes('demo'));
  res.json({
    success: true,
    keyId: keyId || 'rzp_test_library_demo',
    isTestKey,
    mode: isTestKey ? 'razorpay_test_api' : 'sandbox_simulation',
    currency: 'INR',
    plans: Object.values(SUBSCRIPTION_PLANS)
  });
};

/**
 * Create a new Razorpay order for subscription upgrade
 */
exports.createOrder = async (req, res) => {
  try {
    const { planId = 'premium_monthly' } = req.body;
    const plan = SUBSCRIPTION_PLANS[planId];
    if (!plan) {
      return res.status(400).json({ success: false, message: 'Invalid subscription plan selected' });
    }

    const userId = req.user.userId;
    const connection = await pool.getConnection();

    let memberId = null;
    const [memberRows] = await connection.query(
      'SELECT MemberID, FullName, SubscriptionTier FROM memberprofiles WHERE UserID = ?',
      [userId]
    );
    if (memberRows.length) {
      memberId = memberRows[0].MemberID;
    }

    let razorpayOrderId;
    let isRealOrder = false;
    const receipt = `rcpt_${userId}_${Date.now().toString().slice(-8)}`;

    const rzp = getRazorpayClient();
    // Try creating order via Razorpay Test API if client initialized
    if (rzp) {
      try {
        console.log(`[Payments] Initiating order with Razorpay Test API for ${plan.name} (₹${plan.amount})...`);
        const order = await rzp.orders.create({
          amount: plan.amount * 100, // in paise
          currency: 'INR',
          receipt,
          notes: {
            userId: String(userId),
            memberId: String(memberId || ''),
            planId: plan.id
          }
        });
        razorpayOrderId = order.id;
        isRealOrder = true;
        console.log(`[Payments] Order created via Razorpay Test API: ${order.id}`);
      } catch (rzpErr) {
        console.warn('[Payments] Razorpay Test API request failed:', rzpErr.message, 'Falling back to sandbox order');
        razorpayOrderId = `order_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      }
    } else {
      console.log('[Payments] Razorpay test key not configured in .env (or using default placeholder). Using simulated test order.');
      razorpayOrderId = `order_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    }

    // Record pending transaction
    await connection.query(`
      INSERT INTO payment_transactions
        (UserID, MemberID, RazorpayOrderID, PlanName, Amount, Currency, PaymentStatus, PaymentMethod)
      VALUES
        (?, ?, ?, ?, ?, 'INR', 'PENDING', 'razorpay')
    `, [
      userId,
      memberId,
      razorpayOrderId,
      plan.name,
      plan.amount
    ]);

    connection.release();

    await logAuditAction(
      userId,
      'PAYMENT_INITIATED',
      'Payments',
      null,
      { orderId: razorpayOrderId, plan: plan.name, amount: plan.amount, isRealOrder },
      req.ip,
      200
    );

    res.json({
      success: true,
      orderId: razorpayOrderId,
      amount: plan.amount * 100, // in paise for Razorpay checkout
      currency: 'INR',
      planName: plan.name,
      isRealOrder,
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_library_demo'
    });
  } catch (error) {
    console.error('[Payments] Create order error:', error);
    res.status(500).json({ success: false, message: 'Could not create payment order', error: error.message });
  }
};

/**
 * Verify Razorpay payment signature and activate subscription
 */
exports.verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planId = 'premium_monthly',
      paymentMethod = 'razorpay'
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id) {
      return res.status(400).json({ success: false, message: 'Payment details are missing' });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    // If real secret is configured and not test fallback, verify cryptographically
    if (secret && !secret.includes('your_') && razorpay_signature && !razorpay_order_id.startsWith('order_test_')) {
      const generatedSig = crypto
        .createHmac('sha256', secret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generatedSig !== razorpay_signature) {
        return res.status(400).json({ success: false, message: 'Payment verification failed: invalid signature' });
      }
    }

    const plan = SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.premium_monthly;
    const userId = req.user.userId;
    const connection = await pool.getConnection();

    const startDate = new Date();
    const endDate = new Date(Date.now() + plan.durationDays * 86400000);

    // Update payment transaction record
    await connection.query(`
      UPDATE payment_transactions
      SET RazorpayPaymentID = ?,
          RazorpaySignature = ?,
          PaymentStatus = 'SUCCESS',
          PaymentMethod = ?,
          StartDate = ?,
          EndDate = ?
      WHERE RazorpayOrderID = ? OR (UserID = ? AND PaymentStatus = 'PENDING')
      ORDER BY TransactionID DESC LIMIT 1
    `, [
      razorpay_payment_id,
      razorpay_signature || 'verified_test_sig',
      paymentMethod,
      startDate,
      endDate,
      razorpay_order_id,
      userId
    ]);

    // Upgrade member to Premium
    await connection.query(`
      UPDATE memberprofiles
      SET SubscriptionTier = 'Premium',
          LastActiveDate = NOW()
      WHERE UserID = ?
    `, [userId]);

    // Send notification
    const [memberRows] = await connection.query(
      'SELECT MemberID FROM memberprofiles WHERE UserID = ?',
      [userId]
    );
    if (memberRows.length) {
      await connection.query(`
        INSERT INTO notifications (MemberID, Message, NotificationType, SentDate, IsRead)
        VALUES (?, ?, 'system', NOW(), 0)
      `, [
        memberRows[0].MemberID,
        `Payment successful! Your ${plan.name} subscription is active. All exclusive books and offline features are now unlocked.`
      ]);
    }

    connection.release();

    await logAuditAction(
      userId,
      'PAYMENT_SUCCESS',
      'Payments',
      null,
      { orderId: razorpay_order_id, paymentId: razorpay_payment_id, plan: plan.name, amount: plan.amount },
      req.ip,
      200
    );

    res.json({
      success: true,
      message: 'Payment verified successfully! Welcome to Premium.',
      subscriptionTier: 'Premium',
      transaction: {
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        planName: plan.name,
        amount: plan.amount,
        startDate,
        endDate
      }
    });
  } catch (error) {
    console.error('[Payments] Verify payment error:', error);
    res.status(500).json({ success: false, message: 'Error verifying payment', error: error.message });
  }
};

/**
 * Get all payment & subscription logs (Admin & Librarian)
 */
exports.getPaymentLogs = async (req, res) => {
  try {
    const { page = 1, limit = 25, status, search } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT pt.TransactionID, pt.UserID, pt.MemberID, pt.RazorpayOrderID,
             pt.RazorpayPaymentID, pt.PlanName, pt.Amount, pt.Currency,
             pt.PaymentStatus, pt.PaymentMethod, pt.StartDate, pt.EndDate, pt.CreatedAt,
             u.Username, u.Email, mp.FullName
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
    if (search) {
      query += ` AND (u.Username LIKE ? OR u.Email LIKE ? OR mp.FullName LIKE ? OR pt.RazorpayPaymentID LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY pt.CreatedAt DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const connection = await pool.getConnection();
    const [transactions] = await connection.query(query, params);

    const [countResult] = await connection.query(
      'SELECT COUNT(*) as total, SUM(CASE WHEN PaymentStatus="SUCCESS" THEN Amount ELSE 0 END) as totalRevenue FROM payment_transactions'
    );
    const [activeSubscribers] = await connection.query(
      "SELECT COUNT(*) as count FROM memberprofiles WHERE SubscriptionTier = 'Premium'"
    );

    connection.release();

    res.json({
      success: true,
      data: transactions,
      stats: {
        totalRevenue: Number(countResult[0].totalRevenue || 0),
        totalTransactions: Number(countResult[0].total || 0),
        activeSubscribers: Number(activeSubscribers[0].count || 0)
      },
      summary: {
        totalRevenue: Number(countResult[0].totalRevenue || 0),
        totalTransactions: Number(countResult[0].total || 0),
        activeSubscribers: Number(activeSubscribers[0].count || 0)
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching payment logs', error: error.message });
  }
};

/**
 * Get current user's active subscription status & history
 */
exports.getUserSubscription = async (req, res) => {
  try {
    const userId = req.user.userId;
    const connection = await pool.getConnection();

    const [member] = await connection.query(
      'SELECT MemberID, SubscriptionTier, RegistrationDate, LastActiveDate FROM memberprofiles WHERE UserID = ?',
      [userId]
    );

    const [transactions] = await connection.query(
      `SELECT TransactionID, RazorpayOrderID, RazorpayPaymentID, PlanName, Amount, Currency, PaymentStatus, StartDate, EndDate, CreatedAt
       FROM payment_transactions
       WHERE UserID = ?
       ORDER BY CreatedAt DESC LIMIT 10`,
      [userId]
    );

    connection.release();

    const tier = member.length ? member[0].SubscriptionTier : 'Free';
    const isPremium = tier === 'Premium';

    res.json({
      success: true,
      subscriptionTier: tier,
      isPremium,
      member: member[0] || null,
      latestTransaction: transactions.length ? transactions[0] : null,
      history: transactions
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching subscription status', error: error.message });
  }
};
