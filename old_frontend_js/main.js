/**
 * main.js — Main application logic for all pages
 */
"use strict";

// ─── Toast Notification System ───────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container') || createToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('toast--visible'), 10);
  setTimeout(() => {
    toast.classList.remove('toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function createToastContainer() {
  const c = document.createElement('div');
  c.id = 'toast-container';
  c.className = 'toast-container';
  document.body.appendChild(c);
  return c;
}

// ─── Page Initializers ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const app = document.querySelector('#app');
  if (app) app.dataset.ready = 'true';

  // Update auth UI
  Auth.updateUI();

  // Page-specific init
  const page = document.body.dataset.page;
  
  switch (page) {
    case 'home': initHomePage(); break;
    case 'member': initMemberPage(); break;
    case 'librarian': initLibrarianPage(); break;
    case 'admin': initAdminPage(); break;
  }

  // Setup logout buttons
  document.querySelectorAll('[data-action="logout"]').forEach(btn => {
    btn.addEventListener('click', () => API.logout());
  });

  // Setup notification badge
  if (API.isAuthenticated()) {
    updateNotificationBadge();
  }
});

// ─── Notification Badge ─────────────────────────────────────
async function updateNotificationBadge() {
  try {
    const result = await API.getNotifications();
    if (result && result.success && result.unreadCount > 0) {
      document.querySelectorAll('.notification-badge').forEach(badge => {
        badge.textContent = result.unreadCount;
        badge.style.display = 'inline-flex';
      });
    }
  } catch (e) { /* silent */ }
}

// ─── Home Page ──────────────────────────────────────────────
async function initHomePage() {
  // Load books for the grid
  const booksResult = await API.fetchBooks({ limit: 10 });
  if (booksResult && booksResult.success) {
    renderBookGrid('curated-books-grid', booksResult.data);
  }

  // Load categories
  const catResult = await API.fetchCategories();
  if (catResult && catResult.success) {
    renderCollections('collections-grid', catResult.data);
  }

  // Load progress if authenticated
  if (API.isAuthenticated()) {
    const progressResult = await API.getAllProgress();
    if (progressResult && progressResult.success && progressResult.data.length > 0) {
      renderContinueReading('reading-space-content', progressResult.data);
    }
  }

  // Search form
  const searchForm = document.getElementById('search-form');
  if (searchForm) {
    searchForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const query = document.getElementById('library-search').value.trim();
      if (!query) return;
      const result = await API.searchBooks(query);
      if (result && result.success) {
        renderBookGrid('curated-books-grid', result.data);
        document.getElementById('curated-title').textContent = `Search Results for "${query}"`;
        document.querySelector('#curated-section .section-heading__eyebrow').textContent = `${result.data.length} books found`;
      }
    });
  }
}

// ─── Member Page ────────────────────────────────────────────
async function initMemberPage() {
  if (!Auth.requireAuth()) return;

  const user = API.getUser();
  const titleEl = document.querySelector('.top-bar__title');
  if (titleEl) titleEl.textContent = `Welcome back, ${user.username}`;

  // Load reading progress
  const progressResult = await API.getAllProgress();
  if (progressResult && progressResult.success) {
    renderContinueReading('member-reading-content', progressResult.data);
  }

  // Load recent books
  const booksResult = await API.fetchBooks({ limit: 4 });
  if (booksResult && booksResult.success) {
    renderBookGrid('recommended-grid', booksResult.data);
  }

  // Load notifications
  const notifResult = await API.getNotifications();
  if (notifResult && notifResult.success) {
    renderNotifications('member-notifications', notifResult.data);
  }
}

// ─── Librarian Page ─────────────────────────────────────────
async function initLibrarianPage() {
  if (!Auth.requireRole(['Admin', 'Librarian'])) return;

  // Load dashboard stats
  const statsResult = await API.getDashboardStats();
  if (statsResult && statsResult.success) {
    renderDashboardStats('librarian-stats', statsResult.data);
  }

  // Load books table
  const booksResult = await API.fetchBooks({ limit: 10 });
  if (booksResult && booksResult.success) {
    renderBooksTable('librarian-books-table', booksResult.data);
  }

  // Load audit for recent activity
  const auditResult = await API.getAuditLogs({ limit: 5 });
  if (auditResult && auditResult.success) {
    renderActivityList('librarian-activity', auditResult.data);
  }
}

// ─── Admin Page ─────────────────────────────────────────────
async function initAdminPage() {
  if (!Auth.requireRole(['Admin'])) return;

  // Load dashboard stats
  const statsResult = await API.getDashboardStats();
  if (statsResult && statsResult.success) {
    renderAdminStats('admin-stats', statsResult.data);
  }

  // Load audit logs
  const auditResult = await API.getAuditLogs({ limit: 10 });
  if (auditResult && auditResult.success) {
    renderAuditTable('admin-audit-table', auditResult.data);
  }

  // Report buttons
  document.getElementById('btn-gen-reading-report')?.addEventListener('click', async () => {
    const result = await API.generateReadingReport();
    if (result && result.success) showToast('Reading report generated!', 'success');
    else showToast('Failed to generate report', 'error');
  });

  document.getElementById('btn-gen-audit-report')?.addEventListener('click', async () => {
    const result = await API.generateAuditReport();
    if (result && result.success) showToast('Audit report generated!', 'success');
    else showToast('Failed to generate report', 'error');
  });
}

// ─── Rendering Helpers ──────────────────────────────────────

function renderBookGrid(containerId, books) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  if (!books || books.length === 0) {
    container.innerHTML = '<p style="color: var(--color-text-muted);">No books found.</p>';
    return;
  }

  books.forEach(book => {
    const card = document.createElement('a');
    card.href = API.isAuthenticated() ? `/reader.html?id=${book.BookID}` : '/login.html';
    card.className = 'book-card';
    
    const coverStyle = book.CoverImagePath 
      ? `background-image: url('${book.CoverImagePath}'); background-size: cover; background-position: center;`
      : `background-color: ${getBookColor(book.BookID)};`;

    card.innerHTML = `
      <div class="book-card__cover" style="${coverStyle}"></div>
      <h3 class="book-card__title">${book.Title}</h3>
      <p class="book-card__author">${book.Author}</p>
      ${book.GenreName ? `<p class="section-heading__eyebrow">${book.GenreName}</p>` : ''}
    `;
    container.appendChild(card);
  });
}

function renderCollections(containerId, categories) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  categories.forEach(cat => {
    const card = document.createElement('a');
    card.href = '#';
    card.className = 'collection-card';
    card.textContent = `${cat.GenreName} (${cat.BookCount || 0})`;
    card.addEventListener('click', async (e) => {
      e.preventDefault();
      const result = await API.fetchBooks({ category: cat.CategoryID });
      if (result && result.success) {
        renderBookGrid('curated-books-grid', result.data);
        document.getElementById('curated-title').textContent = cat.GenreName;
      }
    });
    container.appendChild(card);
  });
}

function renderContinueReading(containerId, progressData) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  if (!progressData || progressData.length === 0) {
    container.innerHTML = `
      <div class="glass-panel" style="text-align: center; padding: var(--space-2xl);">
        <p style="color: var(--color-text-muted);">Start reading a book to track your progress!</p>
        <a href="/index.html" class="text-button" style="margin-top: var(--space-md); display: inline-block; border-color: var(--color-accent);">Browse Books</a>
      </div>
    `;
    return;
  }

  const grid = document.createElement('div');
  grid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(24rem, 1fr)); gap: var(--space-lg);';

  progressData.slice(0, 3).forEach(p => {
    const coverStyle = p.CoverImagePath
      ? `background-image: url('${p.CoverImagePath}'); background-size: cover; background-position: center;`
      : `background-color: ${getBookColor(p.BookID)};`;

    const panel = document.createElement('div');
    panel.className = 'glass-panel';
    panel.style.cssText = 'display: flex; gap: var(--space-lg);';
    panel.innerHTML = `
      <div style="width: 8rem; flex-shrink: 0;">
        <div class="book-card__cover" style="${coverStyle}"></div>
      </div>
      <div style="display: flex; flex-direction: column; justify-content: center; width: 100%;">
        <h3 class="book-card__title" style="margin:0; font-size: var(--font-size-xl);">${p.Title}</h3>
        <p class="book-card__author" style="margin-bottom: var(--space-sm);">${p.Author}</p>
        <div style="margin-top: auto; margin-bottom: var(--space-xs); display: flex; justify-content: space-between; font-size: var(--font-size-sm);">
          <span class="section-heading__eyebrow">${p.GenreName || ''}</span>
          <strong>${Math.round(p.CompletionPct)}%</strong>
        </div>
        <div class="progress-bar">
          <div class="progress-bar__fill" style="width: ${p.CompletionPct}%;"></div>
        </div>
        <a href="/reader.html?id=${p.BookID}" class="text-button" style="margin-top: var(--space-md); align-self: flex-start; border-color: var(--color-accent); text-decoration: none;">Continue Reading</a>
      </div>
    `;
    grid.appendChild(panel);
  });

  container.appendChild(grid);
}

function renderNotifications(containerId, notifications) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  if (!notifications || notifications.length === 0) {
    container.innerHTML = '<p style="color: var(--color-text-muted); padding: var(--space-md);">No notifications.</p>';
    return;
  }

  const list = document.createElement('ul');
  list.style.cssText = 'list-style: none; padding: 0; display: flex; flex-direction: column; gap: var(--space-sm);';

  notifications.slice(0, 5).forEach(n => {
    const li = document.createElement('li');
    li.className = 'card';
    li.style.padding = 'var(--space-md)';
    li.innerHTML = `
      <div style="display: flex; justify-content: space-between; margin-bottom: var(--space-2xs);">
        <strong style="color: var(--color-text-strong);">${n.Message.substring(0, 60)}${n.Message.length > 60 ? '...' : ''}</strong>
        ${!n.IsRead ? '<span class="status-badge status-badge--pending">New</span>' : `<span class="section-heading__eyebrow">${timeAgo(n.SentDate)}</span>`}
      </div>
      <p style="font-size: var(--font-size-sm); color: var(--color-text-muted);">${n.Message}</p>
    `;
    if (!n.IsRead) {
      li.style.cursor = 'pointer';
      li.addEventListener('click', async () => {
        await API.markNotificationRead(n.NotificationID);
        li.querySelector('.status-badge')?.remove();
      });
    }
    list.appendChild(li);
  });

  container.appendChild(list);
}

function renderDashboardStats(containerId, stats) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = `
    <div class="card stat-card">
      <span class="stat-card__label">Total E-Books</span>
      <span class="stat-card__value">${stats.totalBooks.toLocaleString()}</span>
    </div>
    <div class="card stat-card">
      <span class="stat-card__label">Active Members</span>
      <span class="stat-card__value">${stats.totalMembers.toLocaleString()}</span>
    </div>
    <div class="card stat-card">
      <span class="stat-card__label">Recently Added (30d)</span>
      <span class="stat-card__value">${stats.recentBooks}</span>
    </div>
    <div class="card stat-card glass-panel" style="padding: var(--space-lg); border-color: var(--color-accent);">
      <span class="stat-card__label">Today's Sessions</span>
      <span class="stat-card__value" style="color: var(--color-sage-700);">${stats.activeSessions}</span>
    </div>
  `;
}

function renderAdminStats(containerId, stats) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = `
    <div class="card stat-card">
      <span class="stat-card__label">Total Users</span>
      <span class="stat-card__value">${stats.totalUsers.toLocaleString()}</span>
    </div>
    <div class="card stat-card">
      <span class="stat-card__label">Total E-Books</span>
      <span class="stat-card__value">${stats.totalBooks.toLocaleString()}</span>
    </div>
    <div class="card stat-card">
      <span class="stat-card__label">Active Sessions</span>
      <span class="stat-card__value">${stats.activeSessions}</span>
    </div>
    <div class="card stat-card">
      <span class="stat-card__label">Premium Members</span>
      <span class="stat-card__value" style="color: var(--color-sage-700);">${stats.premiumMembers}</span>
    </div>
  `;
}

function renderBooksTable(containerId, books) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let html = `
    <table class="data-table">
      <thead>
        <tr><th>Title</th><th>Author</th><th>Category</th><th>Format</th><th>Size</th><th>Views</th></tr>
      </thead>
      <tbody>
  `;
  books.forEach(b => {
    html += `
      <tr>
        <td><strong>${b.Title}</strong></td>
        <td>${b.Author}</td>
        <td>${b.GenreName || 'N/A'}</td>
        <td><span class="status-badge status-badge--active">${b.Format}</span></td>
        <td>${b.FileSizeMB} MB</td>
        <td>${b.ViewCount || 0}</td>
      </tr>
    `;
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

function renderAuditTable(containerId, logs) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let html = `
    <table class="data-table">
      <thead>
        <tr><th>Time</th><th>User</th><th>Action</th><th>IP Address</th><th>Status</th></tr>
      </thead>
      <tbody>
  `;
  logs.forEach(l => {
    const statusClass = l.StatusCode >= 200 && l.StatusCode < 400 ? 'status-badge--active' : '';
    const statusStyle = !statusClass ? 'background: #F8E6E6; color: #8C2A2A;' : '';
    html += `
      <tr>
        <td>${new Date(l.Timestamp).toLocaleString()}</td>
        <td>${l.Username || 'System'}</td>
        <td>${l.ActionType}</td>
        <td>${l.IPAddress}</td>
        <td><span class="status-badge ${statusClass}" style="${statusStyle}">${l.StatusCode || 'N/A'}</span></td>
      </tr>
    `;
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

function renderActivityList(containerId, logs) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  const list = document.createElement('ul');
  list.className = 'card';
  list.style.cssText = 'list-style: none; padding: var(--space-md); margin: 0; display: flex; flex-direction: column; gap: var(--space-md);';

  logs.forEach((l, i) => {
    const li = document.createElement('li');
    li.style.cssText = `display: flex; justify-content: space-between; font-size: var(--font-size-sm);${i < logs.length - 1 ? ' border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-sm);' : ''}`;
    li.innerHTML = `
      <span><strong>${l.Username || 'System'}</strong> — ${l.ActionType}</span>
      <span style="color: var(--color-text-muted);">${timeAgo(l.Timestamp)}</span>
    `;
    list.appendChild(li);
  });

  container.appendChild(list);
}

// ─── Utility ────────────────────────────────────────────────

function getBookColor(id) {
  const colors = ['#E2D9C5', '#C8D6D5', '#F1E5E1', '#D3C3DB', '#E6EAD8', '#D5CCE0', '#C5D8D2', '#E8DED0'];
  return colors[(id || 0) % colors.length];
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

window.showToast = showToast;
