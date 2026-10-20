/**
 * api.js — API client module with JWT management
 */
"use strict";

const API = {
  BASE_URL: '/api',
  
  // ─── Token Management ──────────────────────────────────────
  getToken() {
    return localStorage.getItem('token');
  },

  setToken(token) {
    localStorage.setItem('token', token);
  },

  clearToken() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  getUser() {
    try {
      return JSON.parse(localStorage.getItem('user'));
    } catch { return null; }
  },

  setUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
  },

  isAuthenticated() {
    const token = this.getToken();
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch { return false; }
  },

  // ─── HTTP Helpers ──────────────────────────────────────────
  async _fetch(endpoint, options = {}) {
    const url = `${this.BASE_URL}${endpoint}`;
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, { ...options, headers });
      
      if (response.status === 401 || response.status === 403) {
        // Token expired or invalid
        if (window.location.pathname !== '/login.html') {
          this.clearToken();
          window.location.href = '/login.html';
          return null;
        }
      }

      // For file downloads
      if (options.rawResponse) return response;
      
      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      return { success: false, message: 'Network error' };
    }
  },

  async get(endpoint) {
    return this._fetch(endpoint, { method: 'GET' });
  },

  async post(endpoint, body) {
    return this._fetch(endpoint, { method: 'POST', body: JSON.stringify(body) });
  },

  async put(endpoint, body) {
    return this._fetch(endpoint, { method: 'PUT', body: JSON.stringify(body) });
  },

  async del(endpoint) {
    return this._fetch(endpoint, { method: 'DELETE' });
  },

  // ─── Auth ──────────────────────────────────────────────────
  async login(username, password) {
    const result = await this.post('/auth/login', { username, password });
    if (result && result.success) {
      this.setToken(result.token);
      this.setUser(result.user);
    }
    return result;
  },

  async signup(username, email, password, fullName) {
    const result = await this.post('/auth/signup', { username, email, password, fullName });
    if (result && result.success) {
      this.setToken(result.token);
      this.setUser(result.user);
    }
    return result;
  },

  logout() {
    this.clearToken();
    window.location.href = '/login.html';
  },

  async me() {
    return this.get('/auth/me');
  },

  // ─── Books ─────────────────────────────────────────────────
  async fetchBooks(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.get(`/books${query ? '?' + query : ''}`);
  },

  async fetchBook(bookId) {
    return this.get(`/books/${bookId}`);
  },

  async searchBooks(term) {
    return this.get(`/books?search=${encodeURIComponent(term)}`);
  },

  // ─── Reader ────────────────────────────────────────────────
  async getReaderInfo(bookId) {
    return this.get(`/reader/${bookId}/info`);
  },

  getStreamUrl(bookId) {
    return `${this.BASE_URL}/reader/${bookId}/stream`;
  },

  // ─── Progress ──────────────────────────────────────────────
  async getProgress(bookId) {
    return this.get(`/progress/${bookId}`);
  },

  async getAllProgress() {
    return this.get('/progress');
  },

  async updateProgress(bookId, lastPageRead, completionPct) {
    return this.put(`/progress/${bookId}`, { lastPageRead, completionPct });
  },

  // ─── Bookmarks ─────────────────────────────────────────────
  async getBookmarks(bookId) {
    return this.get(`/bookmarks/book/${bookId}`);
  },

  async getAllBookmarks() {
    return this.get('/bookmarks');
  },

  async createBookmark(bookId, pageNumber, cfi, noteText) {
    return this.post(`/bookmarks/book/${bookId}`, { pageNumber, cfi, noteText });
  },

  async updateBookmark(bookmarkId, noteText) {
    return this.put(`/bookmarks/${bookmarkId}`, { noteText });
  },

  async deleteBookmark(bookmarkId) {
    return this.del(`/bookmarks/${bookmarkId}`);
  },

  // ─── Notifications ─────────────────────────────────────────
  async getNotifications() {
    return this.get('/notifications');
  },

  async markNotificationRead(notificationId) {
    return this.put(`/notifications/${notificationId}/read`);
  },

  async markAllNotificationsRead() {
    return this.put('/notifications/read-all');
  },

  // ─── Categories ────────────────────────────────────────────
  async fetchCategories() {
    return this.get('/categories');
  },

  // ─── Members ───────────────────────────────────────────────
  async fetchMembers() {
    return this.get('/members');
  },

  async updateMember(memberId, data) {
    return this.put(`/members/${memberId}`, data);
  },

  // ─── Audit & Reports ──────────────────────────────────────
  async getAuditLogs(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.get(`/audit${query ? '?' + query : ''}`);
  },

  async getAuditStats() {
    return this.get('/audit/stats');
  },

  async getDashboardStats() {
    return this.get('/audit/dashboard');
  },

  async generateReadingReport() {
    return this.post('/reports/reading');
  },

  async generateAuditReport() {
    return this.post('/reports/audit');
  },

  async getReports() {
    return this.get('/reports');
  },

  // ─── Users (Admin) ────────────────────────────────────────
  async deactivateUser(userId) {
    return this.post(`/users/${userId}/deactivate`);
  },

  async registerUser(data) {
    return this.post('/auth/register', data);
  }
};

// Expose globally
window.API = API;
