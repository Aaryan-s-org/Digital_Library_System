/**
 * auth.js — Authentication state management and route guards
 */
"use strict";

const Auth = {
  /**
   * Check if user is authenticated and redirect to login if not
   */
  requireAuth() {
    if (!API.isAuthenticated()) {
      window.location.href = '/login.html';
      return false;
    }
    return true;
  },

  /**
   * Check if user has required role, redirect if not
   */
  requireRole(allowedRoles) {
    if (!this.requireAuth()) return false;
    const user = API.getUser();
    if (!user || !allowedRoles.includes(user.role)) {
      window.location.href = '/index.html';
      return false;
    }
    return true;
  },

  /**
   * Get current user role
   */
  getRole() {
    const user = API.getUser();
    return user ? user.role : null;
  },

  /**
   * Get user display name
   */
  getDisplayName() {
    const user = API.getUser();
    return user ? user.username : 'Guest';
  },

  /**
   * Update the UI elements to reflect auth state
   */
  updateUI() {
    const user = API.getUser();
    const isAuth = API.isAuthenticated();

    // Update avatar and name in sidebar
    document.querySelectorAll('.user-summary__name').forEach(el => {
      el.textContent = isAuth ? (user.username || 'User') : 'Guest User';
    });
    document.querySelectorAll('.user-summary__meta').forEach(el => {
      el.textContent = isAuth ? user.role : 'Sign in for more';
    });
    document.querySelectorAll('.user-summary__avatar, .profile-control__avatar').forEach(el => {
      el.textContent = isAuth ? user.username.charAt(0).toUpperCase() : 'G';
    });
    document.querySelectorAll('.profile-control__label').forEach(el => {
      el.textContent = isAuth ? user.username : 'Guest';
    });

    // Show/hide login/logout buttons
    document.querySelectorAll('[data-auth="guest"]').forEach(el => {
      el.style.display = isAuth ? 'none' : '';
    });
    document.querySelectorAll('[data-auth="user"]').forEach(el => {
      el.style.display = isAuth ? '' : 'none';
    });
  },

  /**
   * Get dashboard URL based on user role
   */
  getDashboardUrl() {
    const role = this.getRole();
    switch (role) {
      case 'Admin': return '/admin.html';
      case 'Librarian': return '/librarian.html';
      case 'Member': return '/member.html';
      default: return '/index.html';
    }
  }
};

window.Auth = Auth;
