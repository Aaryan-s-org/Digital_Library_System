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
      document.querySelector('[data-reader-title]').textContent = 'No book specified.';
      return;
    }

    // Load book metadata
    const infoResult = await API.getReaderInfo(this.bookId);
    if (!infoResult || !infoResult.success) {
      document.querySelector('[data-reader-title]').textContent = 'Failed to load book info.';
      return;
    }
    this.bookMeta = infoResult.data;

    // Update title
    document.querySelector('[data-reader-title]').textContent = this.bookMeta.book.Title;
    document.querySelector('[data-reader-author]').textContent = this.bookMeta.book.Author;
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
    document.querySelector('[data-reader-title]').textContent = 'Loading book...';
    
    fetch(streamUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(response => {
      if (!response.ok) throw new Error('Failed to fetch book');
      return response.arrayBuffer();
    })
    .then(async data => {
      this.book = ePub(data);
      this.rendition = this.book.renderTo(document.querySelector('[data-reader-content]'), {
        width: '100%',
        height: '65vh',
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

      // Fetch bookmarks to find saved location
      let startLocation = null;
      try {
        const bmResult = await API.getBookmarks(this.bookId);
        if (bmResult && bmResult.success && bmResult.data.length > 0) {
           // Sort by CreatedAt descending to get the most recent bookmark
           const sorted = bmResult.data.sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt));
           const bm = sorted.find(b => b.CFI);
           if (bm) startLocation = bm.CFI;
        }
      } catch (e) {
        console.error('Error fetching bookmarks for start location', e);
      }

      // Restore saved location or start from beginning
      if (startLocation) {
        this.rendition.display(startLocation);
      } else if (this.bookMeta.progress && this.bookMeta.progress.LastPageRead > 0) {
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
        document.querySelector('[data-reader-title]').textContent = '';
        document.body.classList.add('reader--loaded');
        
        // Generate locations for progress
        return this.book.locations.generate(1024);
      }).then(() => {
        // Locations generated
        if (this.currentLocation) {
          this.updateProgressUI(this.currentLocation);
        }
      });
    })
    .catch(err => {
      console.error('Book load error:', err);
      document.querySelector('[data-reader-title]').textContent = 'Error loading book. Please try again.';
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
    
    const progressBar = document.querySelector('[data-reader-progress]');
    const progressText = document.querySelector('[data-reader-progress-label]');
    
    if (progressBar) progressBar.value = percentage;
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
    document.querySelector('[data-reader-prev]').addEventListener('click', () => {
      if (this.rendition) this.rendition.prev();
    });

    // Next page
    document.querySelector('[data-reader-next]').addEventListener('click', () => {
      if (this.rendition) this.rendition.next();
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (!this.rendition) return;
      if (e.key === 'ArrowLeft') this.rendition.prev();
      if (e.key === 'ArrowRight') this.rendition.next();
    });

    // Add bookmark
    document.querySelector('[data-reader-bookmark]').addEventListener('click', () => {
      this.addBookmark();
    });

    // Settings panel
    const settingsBtn = document.querySelector('[data-reader-settings]');
    const settingsPanel = document.getElementById('reader-settings');
    const settingsClose = document.querySelector('[data-reader-settings-close]');

    if (settingsBtn && settingsPanel) {
      settingsBtn.addEventListener('click', () => {
        const expanded = settingsBtn.getAttribute('aria-expanded') === 'true';
        settingsBtn.setAttribute('aria-expanded', String(!expanded));
        settingsPanel.hidden = expanded;
      });
      if (settingsClose) {
        settingsClose.addEventListener('click', () => {
          settingsBtn.setAttribute('aria-expanded', 'false');
          settingsPanel.hidden = true;
        });
      }
    }

    // Font size
    const sizeInput = document.querySelector('[data-reader-size]');
    if (sizeInput) {
      sizeInput.addEventListener('input', (e) => {
        if (this.rendition) {
          this.rendition.themes.fontSize(`${e.target.value}rem`);
        }
      });
    }

    // Reading width
    const widthInput = document.querySelector('[data-reader-width]');
    if (widthInput) {
      widthInput.addEventListener('input', (e) => {
        document.querySelector('[data-reader-content]').style.maxWidth = `${e.target.value}rem`;
        document.querySelector('[data-reader-content]').style.margin = '0 auto';
      });
    }

    // Quiet mode
    const quietInput = document.querySelector('[data-reader-quiet]');
    if (quietInput) {
      quietInput.addEventListener('change', (e) => {
        const aside = document.querySelector('.reader-aside');
        const header = document.querySelector('.reader-header');
        if (e.target.checked) {
          if (aside) aside.style.opacity = '0.1';
          if (header) header.style.opacity = '0.1';
        } else {
          if (aside) aside.style.opacity = '1';
          if (header) header.style.opacity = '1';
        }
      });
    }

    // Back button
    document.querySelector('.reader-exit').addEventListener('click', () => {
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
    if (!list) return;
    
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
      const btn = document.querySelector('[data-reader-bookmark]');
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
    
    const watermark = document.querySelector('[data-reader-watermark]');
    if (watermark) {
      watermark.textContent = `${user.username} • Lumina Library`;
    }
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  Reader.init();
});
