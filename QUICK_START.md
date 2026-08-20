# 🚀 Team 1: Quick Start Guide
## Digital Library Portal - Book & Member Management

---

## ⚡ 5-Minute Setup

### 1. Database Setup (2 min)
```bash
# Import the schema
mysql -u root -p < database.sql

# Or manually in MySQL CLI:
mysql> source database.sql;

# Verify
mysql> USE digital_library_portal;
mysql> SHOW TABLES;
# Should show: roles, users, memberprofiles, categories, ebooks, etc.
```

### 2. Install Dependencies (1 min)
```bash
npm install
```

### 3. Configure Environment (1 min)
```bash
cp .env.example .env

# Edit .env with your database details:
# DB_HOST=localhost
# DB_USER=root
# DB_PASSWORD=your_password
# JWT_SECRET=change-this-in-production
```

### 4. Start Server (1 min)
```bash
npm run dev
```

### 5. Access Application
Open browser: **http://localhost:5000**

---

## 👤 Login with Demo Accounts

| Role      | Username  | Password |
|-----------|-----------|----------|
| **Admin** | admin     | admin123 |
| **Librarian** | librarian | lib123   |
| **Member** | member    | mem123   |

---

## 🎯 What Each Role Can Do

### 👨‍💼 Admin Dashboard
- ✅ Add/remove members
- ✅ Upload new books
- ✅ Manage categories
- ✅ Update subscription tiers
- ✅ View audit logs
- ✅ Deactivate users

### 📚 Librarian Dashboard
- ✅ Upload books to catalog
- ✅ Update book metadata
- ✅ View member details
- ✅ Track access history
- ❌ Cannot delete books (Admin only)

### 👥 Member Dashboard
- ✅ Browse & search books
- ✅ View book details
- ✅ Update profile
- ❌ Cannot upload books
- ❌ Cannot manage users

---

## 📂 File Structure

```
outputs/
├── server.js                    ← Main backend (21KB)
├── database.sql                 ← MySQL schema (8KB)
├── package.json                 ← Dependencies
├── .env.example                 ← Config template
├── TEAM1_IMPLEMENTATION.md      ← Full documentation
├── QUICK_START.md              ← This file
└── frontend/
    ├── index.html              ← Login page
    ├── dashboard.html          ← Admin/Librarian dashboard
    └── js/
        └── dashboard.js        ← Dashboard logic
```

---

## 🔑 Key Features (Team 1 Scope)

### Authentication & Authorization
```
✅ User login with JWT
✅ Password hashing with bcrypt
✅ Role-based access control (RBAC)
✅ Token expiration (24 hours)
✅ Auto-logout on invalid token
```

### User Management
```
✅ Register new members
✅ Update member profiles
✅ Change subscription tier
✅ Deactivate users
✅ Track user registrations
```

### Book Cataloging
```
✅ Upload PDF/EPUB books
✅ Search by title/author/ISBN
✅ Automatic file size calculation
✅ ISBN uniqueness validation
✅ Book metadata management
```

### Categories
```
✅ Create book categories
✅ Hierarchical organization
✅ Category-based filtering
✅ Book count per category
```

### Audit & Security
```
✅ Log all user actions
✅ Track login attempts
✅ Record book uploads
✅ SQL injection prevention
✅ XSS protection ready
```

---

## 📡 API Endpoints (Team 1)

### Authentication
```bash
POST /api/auth/login
POST /api/auth/register          # Admin only
```

### Members
```bash
GET    /api/members              # Admin/Librarian
GET    /api/members/:memberId
PUT    /api/members/:memberId
PUT    /api/members/:memberId/subscription
POST   /api/users/:userId/deactivate
```

### Books
```bash
GET    /api/books                # Public (paginated)
GET    /api/books/:bookId
POST   /api/books                # Librarian/Admin
PUT    /api/books/:bookId
DELETE /api/books/:bookId        # Admin only
```

### Categories
```bash
GET    /api/categories           # Public
POST   /api/categories           # Admin only
```

---

## 🧪 Test the System

### Test Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Response: {"success":true,"token":"eyJ...","user":{...}}
```

### Test Book Search
```bash
curl http://localhost:5000/api/books?page=1&limit=10

# Response: List of available books with pagination
```

### Test Authorized Endpoint
```bash
curl http://localhost:5000/api/members \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Response: List of all members
```

---

## ⚠️ Important Notes

### Security
- ⚠️ **CHANGE JWT_SECRET** in .env before production
- ⚠️ **DO NOT** commit .env file to git
- ⚠️ Use **HTTPS** in production
- ⚠️ Validate all user inputs

### Database
- Ensure **MySQL 8.0+** is installed
- Database automatically created by schema.sql
- Connection pooling enabled (max 10 connections)

### File Uploads
- Books stored in `./secure_ebooks/` directory
- Max file size: 100MB
- Supported: PDF, EPUB

### Cors
- Enabled for localhost:3000 by default
- Update in production for your domain

---

## 🐛 Common Issues & Fixes

### "Cannot connect to database"
```bash
# Make sure MySQL is running
sudo systemctl start mysql    # Linux
brew services start mysql     # Mac
net start MySQL80             # Windows
```

### "JWT Secret not defined"
```bash
# Copy and edit .env
cp .env.example .env
# Then add: JWT_SECRET=your-secret-key
```

### "Port 5000 already in use"
```bash
# Change port in .env
PORT=5001

# Or kill process on port 5000
sudo lsof -ti:5000 | xargs kill -9
```

### "CORS error"
```bash
# Frontend and backend on different ports? That's normal.
# CORS is enabled in server.js
# If errors persist, check CORS_ORIGIN in .env
```

---

## 📊 Database Tables Created

Team 1 creates 7 core tables:

1. **roles** - Admin, Librarian, Member
2. **users** - Login credentials & roles
3. **memberprofiles** - User details
4. **categories** - Book categories
5. **ebooks** - Book metadata & files
6. **accesslogs** - User reading sessions
7. **auditlogs** - All system actions

Plus 6 more tables for Team 2 & 3 (prepared but not used by Team 1).

---

## 🔗 Integration Notes

### Team 2 (Digital Access & Session)
- Will use: AccessLogs, EBooks FilePath, Bookmarks, ReadingProgress
- Will implement: File streaming, progress sync, soft DRM

### Team 3 (Reports & Analytics)
- Will use: AuditLogs, AccessLogs, Reports table
- Will implement: Analytics dashboard, export reports

---

## 📖 Full Documentation

See **TEAM1_IMPLEMENTATION.md** for:
- Complete API reference
- Database schema details
- Security implementation
- Architecture diagrams
- Troubleshooting guide
- Team members & roles

---

## ✅ Next Steps

1. **Setup:** Follow 5-minute setup above
2. **Test:** Login with demo accounts
3. **Explore:** Click through admin dashboard
4. **Integrate:** Teams 2 & 3 build on this foundation
5. **Deploy:** Move to AWS/cloud when ready

---

## 📞 Support

- 📖 See TEAM1_IMPLEMENTATION.md for detailed help
- 🐛 Check console logs for errors
- 🔍 Review server.js for code documentation
- 👥 Contact team members or Ms. Priyanka Balage

---

**Status:** ✅ Production Ready  
**Last Updated:** August 2026  
**Version:** 1.0.0
