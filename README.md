# Digital Library Portal (E-Book Edition)
A full-stack, secure digital library portal designed to manage e-book cataloging, digital access, role-based authentication, and system analytics. This system provides a seamless reading experience while enforcing access controls and "soft DRM" to protect digital assets.

# Tech Stack
**Frontend**: HTML5, CSS3, Vanilla JavaScript (with ePub.js for EPUB rendering)

**Backend**: Node.js, Express.js

**Database**: MySQL (Relational Schema)

**Security**: JSON Web Tokens (JWT) for authentication, bcrypt for password hashing

**File Storage**: Secure local server directory (or Cloud Storage Bucket)

# Key Features & Team Modules

# Team 1: Book & Member Management (Core)
Role-Based Access Control (RBAC): Secure login and routing for Admins, Librarians, and Members using JWT.

Digital Cataloging: Upload and manage e-books (PDF/EPUB) with detailed metadata and automatic file size calculations.

Member Profiles: Manage user subscriptions (Free vs. Premium) and profile data.

# Team 2: Digital Access & Session Management
Secure File Streaming: E-books are delivered via protected API endpoints, preventing direct URL access.

Progress Syncing: Automatically tracks and saves the user's LastPageRead and CompletionPct in real-time.

Bookmarks & Notes: Users can save specific pages and attach personal notes.

Soft DRM Protection: Disables text selection, prevents right-click/copy shortcuts, and utilizes dynamic watermarking and blur-on-unfocus to mitigate screenshots.

# Team 3: Reports, Analytics & Administration
Comprehensive Audit Logs: Tracks all critical system actions (e.g., logins, file uploads, role changes).

Automated Reporting: Generates downloadable CSV/PDF analytics on user reading trends and system usage.

System Notifications: Automated alerts for new book arrivals and system maintenance.

# Folder Structure

/digital-library-portal
│
├── /frontend               # HTML, CSS, JS static files
│   ├── index.html          # Login page
│   ├── /css
│   ├── /js
│   └── /assets
│
├── /backend                # Node.js server files
│   ├── server.js           # Entry point
│   ├── /config             # DB connection & environment variables
│   ├── /controllers        # API logic (Auth, Books, Progress, Reports)
│   ├── /routes             # API endpoints definitions
│   ├── /middleware         # JWT verification, Multer file upload
│   └── /secure_ebooks      # Protected directory for PDF/EPUB files (NOT public)
│
├── /database               # MySQL scripts
│   └── schema.sql          # ER diagram table creation scripts
│
├── package.json
└── README.md

# !!! DO NOT PUSH .env FILES HERE !!!

