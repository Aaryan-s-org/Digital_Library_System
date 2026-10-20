/**
 * seedUsers.js — Populates the database with realistic initial users
 *
 * Creates users across all roles:
 *  - Role 1: Admin
 *  - Role 2: Librarian
 *  - Role 3: Member (with MemberProfiles, notifications, and reading progress)
 *
 * All passwords are encrypted with bcrypt (10 rounds).
 */

const bcrypt = require('bcrypt');
const pool = require('../config/db');

const BCRYPT_ROUNDS = 10;

const USERS_TO_SEED = [
  // ==========================================
  // Administrators (Role 1)
  // ==========================================
  {
    username: 'admin_sarah',
    email: 'sarah.admin@luminalibrary.com',
    password: 'AdminPassword123!',
    roleId: 1, // Admin
    isActive: 1,
    profile: null
  },
  {
    username: 'admin_dev',
    email: 'dev.admin@luminalibrary.com',
    password: 'AdminPassword123!',
    roleId: 1, // Admin
    isActive: 1,
    profile: null
  },

  // ==========================================
  // Librarians (Role 2)
  // ==========================================
  {
    username: 'librarian_clara',
    email: 'clara.oswald@luminalibrary.com',
    password: 'LibrarianPassword123!',
    roleId: 2, // Librarian
    isActive: 1,
    profile: null
  },
  {
    username: 'librarian_rohit',
    email: 'rohit.sharma@luminalibrary.com',
    password: 'LibrarianPassword123!',
    roleId: 2, // Librarian
    isActive: 1,
    profile: null
  },

  // ==========================================
  // Members (Role 3)
  // ==========================================
  {
    username: 'aarav_mehta',
    email: 'aarav.mehta@university.edu',
    password: 'MemberPassword123!',
    roleId: 3, // Member
    isActive: 1,
    profile: {
      fullName: 'Aarav Mehta',
      subscriptionTier: 'Premium',
      department: 'Information Technology',
      enrollmentYear: 2024,
      phoneNumber: '+1-555-0142',
      isVerified: 1
    },
    readingProgress: [
      { bookId: 1, lastPageRead: 45, completionPct: 35.5 },
      { bookId: 2, lastPageRead: 120, completionPct: 78.0 }
    ]
  },
  {
    username: 'sana_iyer',
    email: 'sana.iyer@techlab.org',
    password: 'MemberPassword123!',
    roleId: 3, // Member
    isActive: 1,
    profile: {
      fullName: 'Sana Iyer',
      subscriptionTier: 'Free',
      department: 'Computer Science',
      enrollmentYear: 2025,
      phoneNumber: '+1-555-0189',
      isVerified: 1
    },
    readingProgress: [
      { bookId: 2, lastPageRead: 15, completionPct: 12.0 }
    ]
  },
  {
    username: 'kabir_shah',
    email: 'kabir.shah@designhub.co',
    password: 'MemberPassword123!',
    roleId: 3, // Member
    isActive: 1,
    profile: {
      fullName: 'Kabir Shah',
      subscriptionTier: 'Premium',
      department: 'Graphic & UI Design',
      enrollmentYear: 2023,
      phoneNumber: '+1-555-0177',
      isVerified: 1
    },
    readingProgress: [
      { bookId: 3, lastPageRead: 85, completionPct: 62.5 },
      { bookId: 5, lastPageRead: 200, completionPct: 95.0 }
    ]
  },
  {
    username: 'emily_clark',
    email: 'emily.clark@litstudies.edu',
    password: 'MemberPassword123!',
    roleId: 3, // Member
    isActive: 1,
    profile: {
      fullName: 'Emily Clark',
      subscriptionTier: 'Free',
      department: 'English Literature',
      enrollmentYear: 2024,
      phoneNumber: '+1-555-0193',
      isVerified: 1
    },
    readingProgress: [
      { bookId: 4, lastPageRead: 32, completionPct: 24.0 }
    ]
  },
  {
    username: 'david_chen',
    email: 'david.chen@quantumresearch.org',
    password: 'MemberPassword123!',
    roleId: 3, // Member
    isActive: 1,
    profile: {
      fullName: 'David Chen',
      subscriptionTier: 'Premium',
      department: 'Applied Physics',
      enrollmentYear: 2022,
      phoneNumber: '+1-555-0115',
      isVerified: 1
    },
    readingProgress: [
      { bookId: 1, lastPageRead: 90, completionPct: 72.0 }
    ]
  },
  {
    username: 'ananya_sharma',
    email: 'ananya.sharma@medschool.edu',
    password: 'MemberPassword123!',
    roleId: 3, // Member
    isActive: 1,
    profile: {
      fullName: 'Ananya Sharma',
      subscriptionTier: 'Free',
      department: 'Medical Sciences',
      enrollmentYear: 2025,
      phoneNumber: '+1-555-0164',
      isVerified: 1
    }
  },
  {
    username: 'lucas_muller',
    email: 'lucas.muller@historyarchives.eu',
    password: 'MemberPassword123!',
    roleId: 3, // Member
    isActive: 1,
    profile: {
      fullName: 'Lucas Müller',
      subscriptionTier: 'Premium',
      department: 'European History',
      enrollmentYear: 2023,
      phoneNumber: '+1-555-0131',
      isVerified: 1
    }
  },
  {
    username: 'maya_patel',
    email: 'maya.patel@creativearts.edu',
    password: 'MemberPassword123!',
    roleId: 3, // Member
    isActive: 1,
    profile: {
      fullName: 'Maya Patel',
      subscriptionTier: 'Free',
      department: 'Creative Writing & Poetry',
      enrollmentYear: 2026,
      phoneNumber: '+1-555-0158',
      isVerified: 1
    }
  },
  {
    username: 'marcus_wright',
    email: 'marcus.wright@robotics.edu',
    password: 'MemberPassword123!',
    roleId: 3, // Member
    isActive: 1,
    profile: {
      fullName: 'Marcus Wright',
      subscriptionTier: 'Premium',
      department: 'Robotics & AI',
      enrollmentYear: 2024,
      phoneNumber: '+1-555-0199',
      isVerified: 1
    }
  },
  {
    username: 'priya_nair',
    email: 'priya.nair@datascience.org',
    password: 'MemberPassword123!',
    roleId: 3, // Member
    isActive: 1,
    profile: {
      fullName: 'Priya Nair',
      subscriptionTier: 'Premium',
      department: 'Data Science',
      enrollmentYear: 2025,
      phoneNumber: '+1-555-0182',
      isVerified: 1
    }
  }
];

async function seedUsers() {
  console.log('==============================================');
  console.log(' Starting User Database Seeding');
  console.log('==============================================\n');

  const connection = await pool.getConnection();

  try {
    const summary = [];

    for (const userData of USERS_TO_SEED) {
      // Check if user already exists
      const [existing] = await connection.query(
        'SELECT UserID, Username, Email FROM users WHERE Username = ? OR Email = ?',
        [userData.username, userData.email]
      );

      let userId;
      let passwordHash;

      if (existing.length > 0) {
        userId = existing[0].UserID;
        console.log(`[EXISTS] User "${userData.username}" already exists (ID: ${userId}). Updating record...`);
        
        // Re-hash password to ensure credentials work
        passwordHash = await bcrypt.hash(userData.password, BCRYPT_ROUNDS);

        await connection.query(
          `UPDATE users SET PasswordHash = ?, RoleID = ?, IsActive = ? WHERE UserID = ?`,
          [passwordHash, userData.roleId, userData.isActive, userId]
        );
      } else {
        passwordHash = await bcrypt.hash(userData.password, BCRYPT_ROUNDS);

        const [result] = await connection.query(
          `INSERT INTO users (Username, Email, PasswordHash, RoleID, IsActive)
           VALUES (?, ?, ?, ?, ?)`,
          [userData.username, userData.email, passwordHash, userData.roleId, userData.isActive]
        );
        userId = result.insertId;
        console.log(`[CREATED] User "${userData.username}" created successfully (ID: ${userId}).`);
      }

      // Member Profile handling
      let memberId = null;
      if (userData.roleId === 3 && userData.profile) {
        const [existingProfile] = await connection.query(
          'SELECT MemberID FROM memberprofiles WHERE UserID = ?',
          [userId]
        );

        if (existingProfile.length > 0) {
          memberId = existingProfile[0].MemberID;
          await connection.query(
            `UPDATE memberprofiles 
             SET FullName = ?, Email = ?, SubscriptionTier = ?, PhoneNumber = ?, Department = ?, EnrollmentYear = ?, IsVerified = ?
             WHERE MemberID = ?`,
            [
              userData.profile.fullName,
              userData.email,
              userData.profile.subscriptionTier,
              userData.profile.phoneNumber,
              userData.profile.department,
              userData.profile.enrollmentYear,
              userData.profile.isVerified,
              memberId
            ]
          );
          console.log(`  -> Member profile updated for ${userData.profile.fullName} (MemberID: ${memberId})`);
        } else {
          const [profileResult] = await connection.query(
            `INSERT INTO memberprofiles 
             (UserID, FullName, Email, SubscriptionTier, PhoneNumber, Department, EnrollmentYear, IsVerified)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              userId,
              userData.profile.fullName,
              userData.email,
              userData.profile.subscriptionTier,
              userData.profile.phoneNumber,
              userData.profile.department,
              userData.profile.enrollmentYear,
              userData.profile.isVerified
            ]
          );
          memberId = profileResult.insertId;
          console.log(`  -> Member profile created for ${userData.profile.fullName} (MemberID: ${memberId})`);

          // Insert welcome notification
          await connection.query(
            `INSERT INTO notifications (MemberID, Message, NotificationType)
             VALUES (?, 'Welcome to Lumina Library! Your account is active. Enjoy reading.', 'welcome')`,
            [memberId]
          );
        }

        // Add reading progress if specified
        if (userData.readingProgress && userData.readingProgress.length > 0 && memberId) {
          for (const prog of userData.readingProgress) {
            try {
              await connection.query(
                `INSERT INTO readingprogress (MemberID, BookID, LastPageRead, CompletionPct)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE LastPageRead = VALUES(LastPageRead), CompletionPct = VALUES(CompletionPct)`,
                [memberId, prog.bookId, prog.lastPageRead, prog.completionPct]
              );
            } catch (err) {
              // Ignore if book doesn't exist
            }
          }
        }
      }

      const roleName = userData.roleId === 1 ? 'Admin' : (userData.roleId === 2 ? 'Librarian' : 'Member');
      summary.push({
        UserID: userId,
        Role: roleName,
        Username: userData.username,
        Email: userData.email,
        Password: userData.password,
        Name: userData.profile ? userData.profile.fullName : '—',
        Tier: userData.profile ? userData.profile.subscriptionTier : '—',
        Department: userData.profile ? userData.profile.department : '—'
      });
    }

    console.log('\n==============================================');
    console.log(' Seeding Completed Successfully! Summary:');
    console.log('==============================================');
    console.table(summary);

  } catch (error) {
    console.error('Error during seeding:', error);
  } finally {
    connection.release();
    process.exit(0);
  }
}

seedUsers();
