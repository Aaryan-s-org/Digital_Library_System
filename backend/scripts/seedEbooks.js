/**
 * seedEbooks.js — Scans the ebooks folder and populates the database
 * 
 * Reads ebooks from 'ebooks/LUMEDOT SUBMISSION 1/' directory,
 * copies EPUBs to backend/secure_ebooks/, covers to frontend/assets/covers/,
 * and inserts records into the database.
 */

const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

// Book-to-category mapping based on content/genre
const BOOK_CATEGORIES = {
  'Beasts, Men And Gods': 'Adventure',
  'Captain Blood': 'Adventure',
  'Doom Castle': 'Classic Fiction',
  'In Search Of The Castaways': 'Adventure',
  'Indian Tales': 'Classic Fiction',
  'Off On A Comet': 'Science Fiction',
  'Out Of Time\'s Abyss': 'Science Fiction',
  'The Colors Of Space': 'Science Fiction',
  'The Kipling Reader': 'Classic Fiction',
  'The Life And Adventures Of Santa Claus': 'Children',
  'The Lost Continent': 'Science Fiction',
  'The Metal Monster': 'Science Fiction',
  'The Rock Of Chickamauga': 'History',
  'The South Pole': 'Travel',
  'The Spell Of The Yukon': 'Poetry',
  'The Story Of The Treasure Seekers': 'Children',
  'The Strange Adventures Of Mr': 'Mystery',
  'The Surprising Adventures Of Barren Munchausen': 'Fantasy',
  'The White Company': 'Adventure',
  'Witch-Doctors': 'Horror'
};

// Book descriptions
const BOOK_DESCRIPTIONS = {
  'Beasts, Men And Gods': 'A thrilling account of Ferdinand Ossendowski\'s flight across war-torn Mongolia and encounters with mystical traditions of Central Asia.',
  'Captain Blood': 'The swashbuckling adventures of Peter Blood, a physician turned pirate in the 17th-century Caribbean.',
  'Doom Castle': 'A tale of intrigue and romance set in the Scottish Highlands after the Jacobite rising.',
  'In Search Of The Castaways': 'An exciting expedition across South America, Australia, and New Zealand to rescue a lost sea captain.',
  'Indian Tales': 'A collection of vivid stories set in colonial India, capturing the lives and customs of the subcontinent.',
  'Off On A Comet': 'A fantastical voyage when a comet sweeps up parts of Earth and carries people on a journey through space.',
  'Out Of Time\'s Abyss': 'The final adventure in the Caspak trilogy, exploring a mysterious island where time flows differently.',
  'The Colors Of Space': 'A young man discovers dangerous secrets about interstellar travel and alien civilizations.',
  'The Kipling Reader': 'A curated selection of Rudyard Kipling\'s finest short stories and prose.',
  'The Life And Adventures Of Santa Claus': 'L. Frank Baum\'s imaginative origin story of Santa Claus, from his childhood in an enchanted forest.',
  'The Lost Continent': 'An adventure set in a future where Europe has become a mysterious, savage wilderness.',
  'The Metal Monster': 'A scientific expedition encounters a living, intelligent metal entity in the mountains of Asia.',
  'The Rock Of Chickamauga': 'A gripping Civil War novel following a young soldier through the pivotal Battle of Chickamauga.',
  'The South Pole': 'Roald Amundsen\'s firsthand account of the historic expedition to reach the South Pole.',
  'The Spell Of The Yukon': 'Evocative poetry capturing the raw beauty and harsh reality of the Yukon frontier.',
  'The Story Of The Treasure Seekers': 'Six resourceful Bastable children attempt creative schemes to restore their family\'s fortune.',
  'The Strange Adventures Of Mr': 'Bizarre and fantastical adventures of an ordinary man caught up in extraordinary circumstances.',
  'The Surprising Adventures Of Barren Munchausen': 'The outrageously exaggerated tales of the legendary Baron Munchausen.',
  'The White Company': 'A medieval adventure following a band of English archers during the Hundred Years\' War.',
  'Witch-Doctors': 'An exploration of witchcraft and traditional medicine practices in Africa.'
};

/**
 * Parse book title and author from folder name
 * Pattern: "Title By Author"
 */
function parseBookFolder(folderName) {
  const byIndex = folderName.lastIndexOf(' By ');
  if (byIndex === -1) {
    return { title: folderName, author: 'Unknown' };
  }
  return {
    title: folderName.substring(0, byIndex).trim(),
    author: folderName.substring(byIndex + 4).trim()
  };
}

/**
 * Find a file by extension in a directory
 */
function findFileByExt(dir, ext) {
  try {
    const files = fs.readdirSync(dir);
    return files.find(f => f.toLowerCase().endsWith(ext.toLowerCase()));
  } catch {
    return null;
  }
}

/**
 * Get category ID, creating the category if needed
 */
async function getCategoryId(connection, genreName) {
  const [existing] = await connection.query(
    'SELECT CategoryID FROM categories WHERE GenreName = ?',
    [genreName]
  );
  if (existing.length > 0) return existing[0].CategoryID;

  const [result] = await connection.query(
    'INSERT INTO categories (GenreName, Description) VALUES (?, ?)',
    [genreName, `${genreName} books`]
  );
  return result.insertId;
}

/**
 * Main seed function
 */
async function seedEbooks() {
  const projectRoot = path.resolve(__dirname, '..', '..');
  const ebooksRoot = path.join(projectRoot, 'ebooks', 'LUMEDOT SUBMISSION 1');
  const secureDir = path.join(projectRoot, 'backend', 'secure_ebooks');
  const coversDir = path.join(projectRoot, 'frontend', 'assets', 'covers');

  // Ensure target directories exist
  fs.mkdirSync(secureDir, { recursive: true });
  fs.mkdirSync(coversDir, { recursive: true });

  // Check if ebooks source directory exists
  if (!fs.existsSync(ebooksRoot)) {
    console.log('[Seed] ebooks source directory not found at:', ebooksRoot);
    console.log('[Seed] Skipping ebook seeding.');
    return;
  }

  const folders = fs.readdirSync(ebooksRoot).filter(f => {
    return fs.statSync(path.join(ebooksRoot, f)).isDirectory();
  });

  if (folders.length === 0) {
    console.log('[Seed] No ebook folders found.');
    return;
  }

  console.log(`[Seed] Found ${folders.length} ebook folders. Starting ingestion...`);

  const connection = await pool.getConnection();

  try {
    for (const folder of folders) {
      const folderPath = path.join(ebooksRoot, folder);
      const { title, author } = parseBookFolder(folder);

      // Check if book already exists
      const [existing] = await connection.query(
        'SELECT BookID FROM ebooks WHERE Title = ? AND Author = ?',
        [title, author]
      );

      if (existing.length > 0) {
        console.log(`[Seed] Skipping (exists): ${title}`);
        continue;
      }

      // Find EPUB file
      const epubFile = findFileByExt(folderPath, '.epub');
      if (!epubFile) {
        console.log(`[Seed] No EPUB found for: ${folder}`);
        continue;
      }

      // Find cover image
      const coverFile = findFileByExt(folderPath, '.jpeg') || findFileByExt(folderPath, '.jpg') || findFileByExt(folderPath, '.png');

      // Generate safe filenames
      const safeBasename = title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const epubDest = path.join(secureDir, `${safeBasename}.epub`);
      const epubRelPath = `secure_ebooks/${safeBasename}.epub`;

      // Copy EPUB
      fs.copyFileSync(path.join(folderPath, epubFile), epubDest);
      const fileSizeMB = (fs.statSync(epubDest).size / (1024 * 1024)).toFixed(2);

      // Copy cover if exists
      let coverRelPath = null;
      if (coverFile) {
        const coverExt = path.extname(coverFile).toLowerCase();
        const coverDest = path.join(coversDir, `${safeBasename}${coverExt}`);
        fs.copyFileSync(path.join(folderPath, coverFile), coverDest);
        coverRelPath = `/assets/covers/${safeBasename}${coverExt}`;
      }

      // Determine category
      let categoryName = 'Classic Fiction'; // default
      for (const [key, cat] of Object.entries(BOOK_CATEGORIES)) {
        if (title.startsWith(key)) {
          categoryName = cat;
          break;
        }
      }
      const categoryId = await getCategoryId(connection, categoryName);

      // Get description
      let description = null;
      for (const [key, desc] of Object.entries(BOOK_DESCRIPTIONS)) {
        if (title.startsWith(key)) {
          description = desc;
          break;
        }
      }

      // Insert into database
      await connection.query(
        `INSERT INTO ebooks (CategoryID, Title, Author, Format, FilePath, CoverImagePath, FileSizeMB, UploadedBy, IsAvailable, Description)
         VALUES (?, ?, ?, 'EPUB', ?, ?, ?, 1, 1, ?)`,
        [categoryId, title, author, epubRelPath, coverRelPath, fileSizeMB, description]
      );

      console.log(`[Seed] ✓ Imported: ${title} by ${author} (${fileSizeMB} MB)`);
    }

    console.log('[Seed] Ebook seeding complete!');
  } catch (error) {
    console.error('[Seed] Error during seeding:', error);
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = seedEbooks;

// Run directly if called as script
if (require.main === module) {
  seedEbooks()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
