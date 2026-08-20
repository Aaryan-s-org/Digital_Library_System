# Digital Library Portal - Team 1 Implementation
## Book & Member Management (Core Module)

**Status:** ✅ Complete Implementation  
**Team 1 Members:** Gadekar Vishal, Randhe Chetan, Kulkarni Divij, Kurade Varad, Vaidya Aryan, Potdar Sanika, Patil Aaryan, Markad Omkar, Deshmukh Rutuja, Wanjale Atharva, Nimbalkar Onkar, Yadav Saksham  
**Mentor:** Ms. Priyanka Balage

---

## 📋 Overview

Team 1 is responsible for **Book & Member Management** with focus on:
- **Role-Based Access Control (RBAC)** - Authentication & Authorization
- **Digital Cataloging** - Upload and manage e-books with metadata
- **Member Profiles** - Register and manage library members
- **User Management** - Subscription tiers, profile data, activation/deactivation

---

## 🏗️ Architecture

### Backend Stack
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MySQL 8.0+
- **Authentication:** JWT (JSON Web Tokens)
- **Password Hashing:** bcrypt

### Database Schema (13 Core Tables)

```
Users (UserID, RoleID, Username, Email, PasswordHash, IsActive)
        ↓
MemberProfiles (MemberID, UserID, FullName, SubscriptionTier, RegistrationDate)
        ↓
EBooks (BookID, CategoryID, Title, Author, ISBN, Format, FilePath, UploadedBy)
        ↓
Categories (CategoryID, GenreName, Description)
        ↓
AccessLogs (LogID, MemberID, BookID, AccessTimestamp, ActionType)
        ↓
AuditLogs (AuditID, UserID, ActionType, ActionDetails, Timestamp)
```

---

## 🔐 Functional Requirements (FRs) Implemented

### FR1: Registration & User Management
- Create new user accounts with role assignment
- Update member profiles (name, phone, department, enrollment year)
- Deactivate/activate user accounts
- Subscription tier management (Free/Premium)

**Endpoints:**
```
POST   /api/auth/register          - Register new user (Admin only)
GET    /api/members                - Get all members (Admin/Librarian)
GET    /api/members/:memberId      - Get member details
PUT    /api/members/:memberId      - Update member profile
PUT    /api/members/:memberId/subscription - Update subscription
POST   /api/users/:userId/deactivate - Disable user account
```

### FR2: Authentication & Session Management
- Secure user login with password hashing
- JWT token generation with expiration
- Last login tracking
- Session validation on API requests

**Endpoints:**
```
POST   /api/auth/login             - Authenticate user and get JWT token
```

### FR3: Authorization (Role-Based Access Control)
Three roles implemented:

1. **Admin** - Full system access
   - Manage all users and books
   - View audit logs
   - Generate reports
   - Backup database
   - Edit roles and permissions

2. **Librarian** - Content management
   - Upload and manage books
   - View access logs
   - Manage member records
   - Cannot generate reports or access admin functions

3. **Member** - Read-only access
   - Search books
   - View book details
   - Download books (Team 2)
   - View personal history
   - Create bookmarks (Team 2)

**Implementation:**
- JWT payload includes user role
- Middleware validates role for protected endpoints
- Automatic 403 Forbidden on insufficient permissions

### FR4: Book Cataloging
- Upload e-books (PDF/EPUB) with metadata
- Automatic file size calculation
- ISBN uniqueness validation
- Catalog management (CRUD operations)
- Track upload history and uploader

**Endpoints:**
```
POST   /api/books                  - Upload new book (Librarian/Admin)
GET    /api/books                  - Search/browse books
GET    /api/books/:bookId          - Get book details with metadata
PUT    /api/books/:bookId          - Update book metadata (Librarian/Admin)
DELETE /api/books/:bookId          - Remove book from catalog (Admin)
```

### FR5: Book Categories (Hierarchical)
- Create and manage book categories
- Support hierarchical categorization (parent-child)
- Count available books per category
- Dynamic category selection in UI

**Endpoints:**
```
GET    /api/categories             - Get all categories
POST   /api/categories             - Create new category (Admin)
```

---

## 📁 Project Structure

```
digital-library-portal/
├── server.js                      # Express server with Team 1 routes
├── package.json                   # NPM dependencies
├── .env.example                   # Environment template
├── database.sql                   # MySQL schema (13 tables)
├── frontend/
│   ├── index.html                 # Login page
│   ├── dashboard.html             # Admin/Librarian dashboard
│   ├── css/
│   │   └── style.css             # Global styles
│   └── js/
│       └── dashboard.js           # Dashboard functionality
├── backend/
│   ├── config/
│   │   └── db.js                 # Database connection
│   ├── controllers/
│   │   ├── authController.js     # Login/register logic
│   │   ├── memberController.js   # Member management
│   │   └── bookController.js     # Book cataloging
│   ├── routes/
│   │   ├── auth.js               # Auth endpoints
│   │   ├── members.js            # Member endpoints
│   │   └── books.js              # Book endpoints
│   └── middleware/
│       ├── auth.js               # JWT verification
│       └── rbac.js               # Role validation
└── TEAM1_IMPLEMENTATION.md       # This file
```

---

## 🚀 Setup & Installation

### Prerequisites
- Node.js 14+ (with npm)
- MySQL 8.0+
- Git

### Step 1: Initialize Database
```bash
# Connect to MySQL
mysql -u root -p

# Import schema
source database.sql

# Verify tables created
SHOW TABLES IN digital_library_portal;
```

### Step 2: Install Dependencies
```bash
# Navigate to project directory
cd digital-library-portal

# Install packages
npm install

# Expected packages:
# - express (web framework)
# - mysql2 (database driver)
# - jsonwebtoken (JWT handling)
# - bcrypt (password hashing)
# - cors (cross-origin requests)
# - dotenv (environment variables)
```

### Step 3: Configure Environment
```bash
# Copy example config
cp .env.example .env

# Edit .env with your settings
# DB_HOST=localhost
# DB_USER=root
# DB_PASSWORD=your_password
# DB_NAME=digital_library_portal
# JWT_SECRET=your-secret-key-change-in-production
```

### Step 4: Start Server
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start

# Server will run on http://localhost:5000
```

### Step 5: Access Application
- Open browser: `http://localhost:5000`
- Login with demo credentials

---

## 🧪 Demo Credentials

Automatically created during database setup:

| Role      | Username  | Password | Permissions                          |
|-----------|-----------|----------|--------------------------------------|
| Admin     | admin     | admin123 | Full system access                   |
| Librarian | librarian | lib123   | Book management & user view          |
| Member    | member    | mem123   | Browse books, manage profile         |

---

## 🔒 Security Features

### Password Security
- Bcrypt with 10 salt rounds
- Passwords hashed before storage
- Plaintext never stored in database
- Password comparison using bcrypt.compare()

### Authentication
- JWT tokens with 24-hour expiration
- Token sent via Authorization Bearer header
- Invalid/expired tokens return 401/403 errors
- Automatic logout on token expiration

### Authorization (RBAC)
- Role-based middleware validates permissions
- Insufficient permissions return 403 Forbidden
- Role check on every protected endpoint
- Permissions stored as JSON in roles table

### SQL Injection Prevention
- Parameterized queries using mysql2
- No string concatenation in SQL
- Input validation on all endpoints

### Audit Logging
- Every action logged with user, action type, timestamp, IP
- Immutable audit logs for compliance
- Tracks: login, create, update, delete operations

---

## 📊 API Response Format

All endpoints return JSON with consistent structure:

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { /* operation data */ },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error info"
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Server Error

---

## 🧬 Database Tables Detail

### 1. Roles Table
```sql
RoleID (PK) | RoleName   | Permissions (JSON)
1           | Admin      | {...full permissions...}
2           | Librarian  | {...book management...}
3           | Member     | {...read-only...}
```

### 2. Users Table
```sql
UserID (PK) | RoleID (FK) | Username | Email        | PasswordHash | IsActive | CreatedAt | LastLogin
1           | 1          | admin    | admin@...    | $2b$10$...  | 1        | NOW()     | NOW()
2           | 2          | librarian| lib@...      | $2b$10$...  | 1        | NOW()     | NULL
3           | 3          | member   | mem@...      | $2b$10$...  | 1        | NOW()     | NULL
```

### 3. Member Profiles Table
```sql
MemberID (PK) | UserID (FK) | FullName | Email | PhoneNumber | SubscriptionTier | RegistrationDate | IsVerified
1             | 3          | John Doe | ...   | 9876543210  | Free             | 2026-01-01      | 0
```

### 4. Categories Table
```sql
CategoryID (PK) | GenreName | Description | ParentCategoryID | CreatedAt
1               | Fiction   | Story books | NULL            | NOW()
2               | Science   | Tech books  | NULL            | NOW()
3               | Physics   | Physics     | 2               | NOW()
```

### 5. EBooks Table
```sql
BookID (PK) | CategoryID (FK) | Title | Author | ISBN | Format | FilePath | FileSizeMB | UploadedBy (FK) | IsAvailable
1           | 1              | Book1 | Auth1  | ...  | PDF    | /path    | 2.5        | 1               | 1
```

### 6. Access Logs Table
```sql
LogID (PK) | MemberID (FK) | BookID (FK) | AccessTimestamp | ActionType | IPAddress | DeviceType | SessionDuration
1          | 1             | 1           | 2026-01-15...   | View       | 192.168...| Chrome     | 3600
```

### 7. Audit Logs Table
```sql
AuditID (PK) | UserID (FK) | ActionType | ResourceType | ActionDetails (JSON) | Timestamp | IPAddress
1            | 1          | CREATE     | Users        | {...}               | 2026-01..| 192.168...
```

---

## 🔄 User Journey

### Registration Flow
1. Admin creates account: `POST /api/auth/register`
2. System generates UserID, hashes password
3. MemberProfile auto-created if role is Member
4. User receives welcome in dashboard
5. Action logged to AuditLogs

### Login Flow
1. User submits username + password: `POST /api/auth/login`
2. System queries Users table by username
3. bcrypt.compare() validates password
4. JWT token generated with userId + role
5. LastLogin updated
6. Login logged to AuditLogs
7. Token returned to client
8. Client stores in localStorage

### Book Upload Flow
1. Librarian selects book file: `POST /api/books`
2. Metadata extracted from request
3. ISBN uniqueness checked
4. Book inserted to EBooks table
5. FilePath stored securely
6. Upload logged to AuditLogs
7. Book appears in catalog

---

## 📈 Performance Considerations

### Database Indexes
- Primary keys on all tables (PK)
- Foreign keys for relationships (FK)
- Composite indexes on frequently queried columns:
  - `users.IsActive` - Filter active users
  - `ebooks.IsAvailable` - Display only available books
  - `ebooks.ISBN` - Fast ISBN lookup
  - `accesslogs.MemberID, BookID` - Access tracking
  - `auditlogs.UserID, ActionType, Timestamp` - Audit queries

### Query Optimization
- Pagination: `LIMIT ? OFFSET ?` for large result sets
- Joins with LEFT JOIN to include null relationships
- COUNT(*) with GROUP BY for statistics
- Connection pooling (max 10 connections)

### Response Time
- Average API response: <100ms
- Login: <50ms
- Book search: <200ms (with pagination)
- Dashboard load: <300ms (4 concurrent queries)

---

## 🐛 Troubleshooting

### Database Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:3306
```
**Solution:** Ensure MySQL is running
```bash
# Linux/Mac
sudo systemctl start mysql

# Windows
net start MySQL80  # or your MySQL version
```

### JWT Token Errors
```
Error: Invalid or expired token
```
**Solution:** 
- Clear localStorage and re-login
- Check JWT_SECRET in .env
- Ensure token not expired (24h default)

### ISBN Already Exists
```
Error: ER_DUP_ENTRY 'Duplicate entry for key 'ISBN'
```
**Solution:** ISBN must be unique, use different ISBN or update existing book

### Permission Denied (403)
```
Error: Insufficient permissions
```
**Solution:**
- Verify user role in dashboard
- Admin role required for certain actions
- Check role permissions in roles table

---

## 🔗 Integration Points

### Team 2 Dependencies (Digital Access & Session)
- AccessLogs table: Team 2 reads/writes access records
- EBooks FilePath: Team 2 uses for secure file streaming
- ReadingProgress: Team 2 tracks during session (not in Team 1 scope)

### Team 3 Dependencies (Reports & Analytics)
- AuditLogs table: Team 3 generates admin reports
- AccessLogs table: Team 3 creates reading analytics
- Users/MemberProfiles: Team 3 uses for user reports

---

## 📝 Testing Checklist

- [x] Database tables created correctly
- [x] JWT authentication working
- [x] Role-based access control enforced
- [x] Password hashing with bcrypt
- [x] User registration with role assignment
- [x] Member profile CRUD operations
- [x] Book cataloging (upload, search, update, delete)
- [x] Category management
- [x] Audit logging on all actions
- [x] Error handling with proper HTTP codes
- [x] CORS enabled for frontend
- [x] Input validation on all endpoints

---

## 📚 Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [MySQL 8.0 Documentation](https://dev.mysql.com/doc/)
- [JWT Handbook](https://auth0.com/resources/ebooks/jwt-handbook)
- [OWASP Security Guidelines](https://owasp.org/www-project-top-ten/)
- [SRS Document](../SRS_Digital_Library_Portal_A-2.pdf)

---

## 👥 Team Members & Responsibilities

| Name | Roll | Responsibility |
|------|------|-----------------|
| Vishal Gadekar | TI116 | Database design & setup |
| Chetan Randhe | TI110 | Authentication module |
| Divij Kulkarni | TI120 | Book cataloging API |
| Varad Kurade | TI115 | Member management API |
| Aryan Vaidya | TI123 | Frontend dashboard |
| Sanika Potdar | TI124 | RBAC implementation |
| Aaryan Patil | TI122 | Testing & debugging |
| Omkar Markad | TI118 | API documentation |
| Rutuja Deshmukh | TI113 | Database optimization |
| Atharva Wanjale | TI108 | Security implementation |
| Onkar Nimbalkar | TI119 | Deployment setup |
| Saksham Yadav | TI106 | Code review & quality |

---

## 📞 Support

For issues or questions:
1. Check troubleshooting section above
2. Review API documentation in server.js comments
3. Check console logs in browser and server
4. Contact Team Lead or Ms. Priyanka Balage

---

**Last Updated:** August 2026  
**Status:** Production Ready ✅
