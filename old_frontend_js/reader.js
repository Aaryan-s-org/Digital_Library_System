/**
 * reader.js — ePub.js reader with progress syncing, bookmarks, and soft DRM
 */
"use strict";

const Reader = {
  book: null,
  rendition: null,
  bookId: null,
  bookMeta: null,
  currentLocation: null,
  progressSaveTimer: null,

  /**
   * Initialize the reader
   */
  async init() {
    if (!Auth.requireAuth()) return;

    // Get bookId from URL
    const params = new URLSearchParams(window.location.search);
    this.bookId = params.get('id');
    if (!this.bookId) {
      document.getElementById('reader-status').textContent = 'No book specified.';
      return;
    }

    // Load book metadata
    const infoResult = await API.getReaderInfo(this.bookId);
    if (!infoResult || !infoResult.success) {
      document.getElementById('reader-status').textContent = 'Failed to load book info.';
      return;
    }
    this.bookMeta = infoResult.data;

    // Update title
    document.getElementById('reader-book-title').textContent = this.bookMeta.book.Title;
    document.getElementById('reader-book-author').textContent = this.bookMeta.book.Author;
    document.title = `${this.bookMeta.book.Title} — Lumina Reader`;

    // Initialize ePub.js
    this.loadBook();
    this.setupDRM();
    this.setupControls();
    this.loadBookmarks();
  },

  /**
   * Load the EPUB via ePub.js
   */
  loadBook() {
    const streamUrl = API.getStreamUrl(this.bookId);
    const token = API.getToken();

    // Fetch the EPUB with auth header, then create book from ArrayBuffer
    document.getElementById('reader-status').textContent = 'Loading book...';
    
    fetch(streamUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(response => {
      if (!response.ok) throw new Error('Failed to fetch book');
      return response.arrayBuffer();
    })
    .then(data => {
      this.book = ePub(data);
      this.rendition = this.book.renderTo('reader-viewport', {
        width: '100%',
        height: '100%',
        spread: 'none',
        flow: 'paginated',
        allowScriptedContent: true
      });

      // Apply reader styles
      this.rendition.themes.default({
        'body': {
          'font-family': 'Georgia, "Times New Roman", serif',
          'line-height': '1.8',
          'color': '#3a3a3a',
          'padding': '0 1rem'
        },
        'p': { 'margin-bottom': '1em' },
        'h1, h2, h3': { 
          'font-family': 'Georgia, "Times New Roman", serif',
          'color': '#252928'
        }
      });

      // Restore saved location or start from beginning
      if (this.bookMeta.progress && this.bookMeta.progress.LastPageRead > 0) {
        this.rendition.display(this.bookMeta.progress.LastPageRead);
      } else {
        this.rendition.display();
      }

      // Location changed handler
      this.rendition.on('relocated', (location) => {
        this.currentLocation = location;
        this.updateProgressUI(location);
        this.scheduleProgressSave(location);
      });

      // Ready
      this.book.ready.then(() => {
        document.getElementById('reader-status').textContent = '';
        document.getElementById('reader-container').classList.add('reader--loaded');
        
        // Generate locations for progress
        return this.book.locations.generate(1024);
      }).then(() => {
        // Locations generated
      });
    })
    .catch(err => {
      console.error('Book load error:', err);
      document.getElementById('reader-status').textContent = 'Error loading book. Please try again.';
    });
  },

  /**
   * Update the progress bar and percentage display
   */
  updateProgressUI(location) {
    if (!location || !location.start) return;
    
    const percentage = this.book.locations 
      ? Math.floor(this.book.locations.percentageFromCfi(location.start.cfi) * 100)
      : 0;
    
    const progressBar = document.getElementById('reader-progress-fill');
    const progressText = document.getElementById('reader-progress-text');
    
    if (progressBar) progressBar.style.width = `${percentage}%`;
    if (progressText) progressText.textContent = `${percentage}%`;
  },

  /**
   * Debounced progress save — saves to server every 5 seconds
   */
  scheduleProgressSave(location) {
    if (this.progressSaveTimer) clearTimeout(this.progressSaveTimer);
    
    this.progressSaveTimer = setTimeout(() => {
      if (!location || !location.start) return;
      
      const percentage = this.book.locations
        ? Math.floor(this.book.locations.percentageFromCfi(location.start.cfi) * 100)
        : 0;

      API.updateProgress(this.bookId, location.start.index || 0, percentage);
    }, 5000);
  },

  /**
   * Setup navigation controls
   */
  setupControls() {
    // Previous page
    document.getElementById('btn-prev').addEventListener('click', () => {
      if (this.rendition) this.rendition.prev();
    });

    // Next page
    document.getElementById('btn-next').addEventListener('click', () => {
      if (this.rendition) this.rendition.next();
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (!this.rendition) return;
      if (e.key === 'ArrowLeft') this.rendition.prev();
      if (e.key === 'ArrowRight') this.rendition.next();
    });

    // Add bookmark
    document.getElementById('btn-bookmark').addEventListener('click', () => {
      this.addBookmark();
    });

    // Toggle bookmarks panel
    document.getElementById('btn-toggle-bookmarks').addEventListener('click', () => {
      document.getElementById('bookmarks-panel').classList.toggle('bookmarks-panel--open');
    });

    // Close bookmarks panel
    document.getElementById('btn-close-bookmarks').addEventListener('click', () => {
      document.getElementById('bookmarks-panel').classList.remove('bookmarks-panel--open');
    });

    // Back button
    document.getElementById('btn-back').addEventListener('click', () => {
      window.history.back();
    });
  },

  /**
   * Load existing bookmarks
   */
  async loadBookmarks() {
    const result = await API.getBookmarks(this.bookId);
    if (!result || !result.success) return;

    const list = document.getElementById('bookmarks-list');
    list.innerHTML = '';

    if (result.data.length === 0) {
      list.innerHTML = '<p class="bookmarks-empty">No bookmarks yet. Click the bookmark icon to save your place.</p>';
      return;
    }

    result.data.forEach(bm => {
      const item = document.createElement('div');
      item.className = 'bookmark-item';
      item.innerHTML = `
        <div class="bookmark-item__header">
          <span class="bookmark-item__page">Page ${bm.PageNumber}</span>
          <button class="bookmark-item__delete" data-id="${bm.BookmarkID}" title="Delete bookmark">×</button>
        </div>
        ${bm.NoteText ? `<p class="bookmark-item__note">${bm.NoteText}</p>` : ''}
        <span class="bookmark-item__date">${new Date(bm.CreatedAt).toLocaleDateString()}</span>
      `;
      
      // Navigate to bookmark
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('bookmark-item__delete')) return;
        if (bm.CFI && this.rendition) {
          this.rendition.display(bm.CFI);
        }
        document.getElementById('bookmarks-panel').classList.remove('bookmarks-panel--open');
      });

      // Delete bookmark
      item.querySelector('.bookmark-item__delete').addEventListener('click', async (e) => {
        e.stopPropagation();
        await API.deleteBookmark(bm.BookmarkID);
        this.loadBookmarks();
      });

      list.appendChild(item);
    });
  },

  /**
   * Add a bookmark at current location
   */
  async addBookmark() {
    if (!this.currentLocation) return;

    const noteText = prompt('Add a note for this bookmark (optional):');
    const cfi = this.currentLocation.start ? this.currentLocation.start.cfi : null;
    const pageIndex = this.currentLocation.start ? this.currentLocation.start.index : 0;

    const result = await API.createBookmark(this.bookId, pageIndex, cfi, noteText || null);
    if (result && result.success) {
      this.loadBookmarks();
      // Show feedback
      const btn = document.getElementById('btn-bookmark');
      btn.classList.add('bookmark-saved');
      setTimeout(() => btn.classList.remove('bookmark-saved'), 1500);
    }
  },

  /**
   * Setup Soft DRM protections
   */
  setupDRM() {
    // Disable text selection
    document.addEventListener('selectstart', (e) => e.preventDefault());

    // Disable right-click
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    // Disable copy/print shortcuts
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'p' || e.key === 's' || e.key === 'a')) {
        e.preventDefault();
      }
      // Disable PrintScreen
      if (e.key === 'PrintScreen') {
        e.preventDefault();
      }
    });

    // Blur overlay on tab switch (anti-screenshot)
    document.addEventListener('visibilitychange', () => {
      const overlay = document.getElementById('drm-blur-overlay');
      if (document.hidden) {
        overlay.classList.add('drm-blur--active');
      } else {
        overlay.classList.remove('drm-blur--active');
      }
    });

    // Dynamic watermark
    this.setupWatermark();
  },

  /**
   * Add a subtle dynamic watermark
   */
  setupWatermark() {
    const user = API.getUser();
    if (!user) return;
    
    const watermark = document.getElementById('reader-watermark');
    if (watermark) {
      watermark.textContent = `${user.username} • Lumina Library`;
    }
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  Reader.init();
});
