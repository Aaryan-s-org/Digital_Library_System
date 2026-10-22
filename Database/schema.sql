-- =====================================================
-- Digital Library Portal - Unified Schema
-- MySQL 8.0+
-- =====================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------
-- Table: roles
-- -----------------------------------------------------
DROP TABLE IF EXISTS `roles`;
CREATE TABLE `roles` (
  `RoleID` INT UNSIGNED NOT NULL,
  `RoleName` VARCHAR(50) NOT NULL,
  `Permissions` JSON NOT NULL,
  PRIMARY KEY (`RoleID`),
  UNIQUE KEY `uk_role_name` (`RoleName`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `roles` (`RoleID`, `RoleName`, `Permissions`) VALUES
(1, 'Admin', '{"all": true}'),
(2, 'Librarian', '{"books": ["create","read","update","delete"], "members": ["read","update"], "reports": ["read","create"]}'),
(3, 'Member', '{"books": ["read"], "bookmarks": ["create","read","delete"], "progress": ["read","update"]}');

-- -----------------------------------------------------
-- Table: users
-- -----------------------------------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `UserID` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `RoleID` INT UNSIGNED NOT NULL,
  `Username` VARCHAR(100) NOT NULL,
  `Email` VARCHAR(150) NOT NULL,
  `PasswordHash` VARCHAR(255) NOT NULL,
  `IsActive` TINYINT(1) NOT NULL DEFAULT 1,
  `LastLogin` TIMESTAMP NULL DEFAULT NULL,
  `CreatedAt` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`UserID`),
  UNIQUE KEY `uk_username` (`Username`),
  UNIQUE KEY `uk_email` (`Email`),
  KEY `idx_role` (`RoleID`),
  CONSTRAINT `fk_users_roles` FOREIGN KEY (`RoleID`) REFERENCES `roles` (`RoleID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Default admin (password: admin123)
INSERT INTO `users` (`UserID`, `RoleID`, `Username`, `Email`, `PasswordHash`, `IsActive`) VALUES
(1, 1, 'admin', 'admin@luminalibrary.com', '$2b$10$ULNmQN5FnKQO9GoAgpa3cOdbvU3dHBJ4by.ZEeIxXpG4WMXG1/3Wq', 1),
(2, 2, 'librarian', 'librarian@luminalibrary.com', '$2b$10$ULNmQN5FnKQO9GoAgpa3cOdbvU3dHBJ4by.ZEeIxXpG4WMXG1/3Wq', 1),
(3, 3, 'member', 'member@luminalibrary.com', '$2b$10$ULNmQN5FnKQO9GoAgpa3cOdbvU3dHBJ4by.ZEeIxXpG4WMXG1/3Wq', 1);

-- -----------------------------------------------------
-- Table: memberprofiles
-- -----------------------------------------------------
DROP TABLE IF EXISTS `memberprofiles`;
CREATE TABLE `memberprofiles` (
  `MemberID` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `UserID` INT UNSIGNED NOT NULL,
  `FullName` VARCHAR(150) NOT NULL,
  `Email` VARCHAR(150) NOT NULL,
  `SubscriptionTier` ENUM('Free','Premium') NOT NULL DEFAULT 'Free',
  `RegistrationDate` DATE NOT NULL DEFAULT (CURRENT_DATE),
  `LastActiveDate` TIMESTAMP NULL DEFAULT NULL,
  `IsVerified` TINYINT(1) NOT NULL DEFAULT 0,
  `PhoneNumber` VARCHAR(20) DEFAULT NULL,
  `Department` VARCHAR(100) DEFAULT NULL,
  `EnrollmentYear` INT UNSIGNED DEFAULT NULL,
  PRIMARY KEY (`MemberID`),
  UNIQUE KEY `uk_member_user` (`UserID`),
  UNIQUE KEY `uk_member_email` (`Email`),
  CONSTRAINT `fk_member_user` FOREIGN KEY (`UserID`) REFERENCES `users` (`UserID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Default member profile
INSERT INTO `memberprofiles` (`MemberID`, `UserID`, `FullName`, `Email`) VALUES
(1, 3, 'Demo Member', 'member@luminalibrary.com');

-- -----------------------------------------------------
-- Table: categories
-- -----------------------------------------------------
DROP TABLE IF EXISTS `categories`;
CREATE TABLE `categories` (
  `CategoryID` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `GenreName` VARCHAR(100) NOT NULL,
  `Description` TEXT,
  `ParentCategoryID` INT UNSIGNED DEFAULT NULL,
  PRIMARY KEY (`CategoryID`),
  UNIQUE KEY `uk_genre_name` (`GenreName`),
  KEY `idx_parent` (`ParentCategoryID`),
  CONSTRAINT `fk_category_parent` FOREIGN KEY (`ParentCategoryID`) REFERENCES `categories` (`CategoryID`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `categories` (`CategoryID`, `GenreName`, `Description`) VALUES
(1, 'Adventure', 'Adventure novels and exploration tales'),
(2, 'Science Fiction', 'Science fiction and speculative fiction'),
(3, 'Poetry', 'Poetry collections and verse'),
(4, 'History', 'Historical accounts and non-fiction'),
(5, 'Fantasy', 'Fantasy and mythological fiction'),
(6, 'Children', 'Children''s literature and fairy tales'),
(7, 'Mystery', 'Mystery and detective fiction'),
(8, 'Travel', 'Travel writing and exploration'),
(9, 'Classic Fiction', 'Classic novels and literary fiction'),
(10, 'Horror', 'Horror and supernatural fiction');

-- -----------------------------------------------------
-- Table: ebooks
-- -----------------------------------------------------
DROP TABLE IF EXISTS `ebooks`;
CREATE TABLE `ebooks` (
  `BookID` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `CategoryID` INT UNSIGNED DEFAULT NULL,
  `Title` VARCHAR(255) NOT NULL,
  `Author` VARCHAR(150) NOT NULL,
  `ISBN` VARCHAR(20) DEFAULT NULL,
  `Publisher` VARCHAR(200) DEFAULT NULL,
  `PublishedDate` DATE DEFAULT NULL,
  `Description` TEXT,
  `Format` ENUM('PDF','EPUB') NOT NULL DEFAULT 'EPUB',
  `FilePath` VARCHAR(255) NOT NULL,
  `CoverImagePath` VARCHAR(255) DEFAULT NULL,
  `FileSizeMB` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  `TotalPages` INT UNSIGNED DEFAULT NULL,
  `UploadDate` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `UploadedBy` INT UNSIGNED DEFAULT NULL,
  `IsAvailable` TINYINT(1) NOT NULL DEFAULT 1,
  `ViewCount` INT UNSIGNED NOT NULL DEFAULT 0,
  `LastUpdated` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`BookID`),
  UNIQUE KEY `uk_isbn` (`ISBN`),
  KEY `idx_category` (`CategoryID`),
  KEY `idx_uploaded_by` (`UploadedBy`),
  KEY `idx_available` (`IsAvailable`),
  CONSTRAINT `fk_ebook_category` FOREIGN KEY (`CategoryID`) REFERENCES `categories` (`CategoryID`) ON DELETE SET NULL,
  CONSTRAINT `fk_ebook_uploader` FOREIGN KEY (`UploadedBy`) REFERENCES `users` (`UserID`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: readingprogress
-- -----------------------------------------------------
DROP TABLE IF EXISTS `readingprogress`;
CREATE TABLE `readingprogress` (
  `ProgressID` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `MemberID` INT UNSIGNED NOT NULL,
  `BookID` INT UNSIGNED NOT NULL,
  `LastPageRead` INT UNSIGNED NOT NULL DEFAULT 0,
  `CompletionPct` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `LastAccessed` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`ProgressID`),
  UNIQUE KEY `uk_member_book` (`MemberID`, `BookID`),
  KEY `idx_book` (`BookID`),
  CONSTRAINT `fk_progress_member` FOREIGN KEY (`MemberID`) REFERENCES `memberprofiles` (`MemberID`) ON DELETE CASCADE,
  CONSTRAINT `fk_progress_book` FOREIGN KEY (`BookID`) REFERENCES `ebooks` (`BookID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: bookmarks
-- -----------------------------------------------------
DROP TABLE IF EXISTS `bookmarks`;
CREATE TABLE `bookmarks` (
  `BookmarkID` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `MemberID` INT UNSIGNED NOT NULL,
  `BookID` INT UNSIGNED NOT NULL,
  `PageNumber` INT UNSIGNED NOT NULL,
  `CFI` VARCHAR(500) DEFAULT NULL,
  `NoteText` TEXT,
  `CreatedAt` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`BookmarkID`),
  KEY `idx_member` (`MemberID`),
  KEY `idx_book` (`BookID`),
  CONSTRAINT `fk_bookmark_member` FOREIGN KEY (`MemberID`) REFERENCES `memberprofiles` (`MemberID`) ON DELETE CASCADE,
  CONSTRAINT `fk_bookmark_book` FOREIGN KEY (`BookID`) REFERENCES `ebooks` (`BookID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: accesslogs
-- -----------------------------------------------------
DROP TABLE IF EXISTS `accesslogs`;
CREATE TABLE `accesslogs` (
  `LogID` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `MemberID` INT UNSIGNED DEFAULT NULL,
  `BookID` INT UNSIGNED NOT NULL,
  `AccessTimestamp` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `IPAddress` VARCHAR(45) NOT NULL DEFAULT '0.0.0.0',
  `DeviceType` VARCHAR(100) DEFAULT NULL,
  `SessionDuration` INT UNSIGNED DEFAULT NULL,
  PRIMARY KEY (`LogID`),
  KEY `idx_member` (`MemberID`),
  KEY `idx_book` (`BookID`),
  CONSTRAINT `fk_access_member` FOREIGN KEY (`MemberID`) REFERENCES `memberprofiles` (`MemberID`) ON DELETE SET NULL,
  CONSTRAINT `fk_access_book` FOREIGN KEY (`BookID`) REFERENCES `ebooks` (`BookID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: downloads
-- -----------------------------------------------------
DROP TABLE IF EXISTS `downloads`;
CREATE TABLE `downloads` (
  `DownloadID` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `MemberID` INT UNSIGNED NOT NULL,
  `BookID` INT UNSIGNED NOT NULL,
  `DownloadDate` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `ExpiryDate` TIMESTAMP NOT NULL,
  PRIMARY KEY (`DownloadID`),
  KEY `idx_member` (`MemberID`),
  KEY `idx_book` (`BookID`),
  CONSTRAINT `fk_download_member` FOREIGN KEY (`MemberID`) REFERENCES `memberprofiles` (`MemberID`) ON DELETE CASCADE,
  CONSTRAINT `fk_download_book` FOREIGN KEY (`BookID`) REFERENCES `ebooks` (`BookID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: notifications
-- -----------------------------------------------------
DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
  `NotificationID` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `MemberID` INT UNSIGNED NOT NULL,
  `Message` TEXT NOT NULL,
  `NotificationType` VARCHAR(50) NOT NULL DEFAULT 'info',
  `SentDate` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `IsRead` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`NotificationID`),
  KEY `idx_member` (`MemberID`),
  KEY `idx_read` (`IsRead`),
  CONSTRAINT `fk_notification_member` FOREIGN KEY (`MemberID`) REFERENCES `memberprofiles` (`MemberID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Default welcome notification
INSERT INTO `notifications` (`MemberID`, `Message`, `NotificationType`) VALUES
(1, 'Welcome to Lumina Library! Start exploring our collection of classic e-books.', 'welcome');

-- -----------------------------------------------------
-- Table: auditlogs
-- -----------------------------------------------------
DROP TABLE IF EXISTS `auditlogs`;
CREATE TABLE `auditlogs` (
  `AuditID` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `UserID` INT UNSIGNED DEFAULT NULL,
  `ActionType` VARCHAR(100) NOT NULL,
  `ResourceType` VARCHAR(100) DEFAULT NULL,
  `ResourceID` INT UNSIGNED DEFAULT NULL,
  `ActionDetails` JSON DEFAULT NULL,
  `IPAddress` VARCHAR(45) NOT NULL DEFAULT '0.0.0.0',
  `StatusCode` INT DEFAULT NULL,
  `Timestamp` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`AuditID`),
  KEY `idx_user` (`UserID`),
  KEY `idx_action` (`ActionType`),
  KEY `idx_timestamp` (`Timestamp`),
  CONSTRAINT `fk_audit_user` FOREIGN KEY (`UserID`) REFERENCES `users` (`UserID`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: reports
-- -----------------------------------------------------
DROP TABLE IF EXISTS `reports`;
CREATE TABLE `reports` (
  `ReportID` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `GeneratedBy` INT UNSIGNED DEFAULT NULL,
  `ReportName` VARCHAR(255) NOT NULL,
  `ReportType` VARCHAR(100) NOT NULL,
  `GenerationDate` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `FilePath` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`ReportID`),
  KEY `idx_generated_by` (`GeneratedBy`),
  CONSTRAINT `fk_report_user` FOREIGN KEY (`GeneratedBy`) REFERENCES `users` (`UserID`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: backuphistory
-- -----------------------------------------------------
DROP TABLE IF EXISTS `backuphistory`;
CREATE TABLE `backuphistory` (
  `BackupID` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `BackupDate` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `Status` ENUM('Success','Failed') NOT NULL,
  `FilePath` VARCHAR(255) NOT NULL,
  `BackupSizeMB` DECIMAL(8,2) NOT NULL,
  PRIMARY KEY (`BackupID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: searchhistory
-- -----------------------------------------------------
DROP TABLE IF EXISTS `searchhistory`;
CREATE TABLE `searchhistory` (
  `SearchID` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `UserID` INT UNSIGNED NULL,
  `MemberID` INT UNSIGNED NULL,
  `SearchQuery` VARCHAR(255) NOT NULL,
  `CategoryFilter` INT UNSIGNED NULL,
  `ResultsCount` INT UNSIGNED NOT NULL DEFAULT 0,
  `CreatedAt` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`SearchID`),
  KEY `idx_search_user` (`UserID`),
  KEY `idx_search_member` (`MemberID`),
  KEY `idx_search_created` (`CreatedAt`),
  CONSTRAINT `fk_search_user` FOREIGN KEY (`UserID`) REFERENCES `users` (`UserID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET FOREIGN_KEY_CHECKS = 1;

