"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const isAuth = typeof window.API !== "undefined" && window.API.isAuthenticated();
  const role = typeof window.Auth !== "undefined" ? window.Auth.getRole() : null;
  const user = isAuth && window.API.getUser() ? window.API.getUser() : null;
  const username = user?.username || "Guest";
  const currentPage = window.location.pathname.split("/").pop() || "index.html";

  let header = document.querySelector(".site-header");
  if (!header) {
    header = document.createElement("header");
    header.className = "site-header";
    document.body.prepend(header);
  }

  const publicLinks = [["Discover", "index.html"], ["Collections", "index.html#category-title"], ["AI Suggestions", "index.html#spotlight-title"]];
  const memberLinks = [["Discover", "index.html"], ["My Library", "member.html#library"], ["Collections", "member.html#collections"]];
  const librarianLinks = [["Dashboard", "librarian.html"], ["Catalog", "librarian.html#catalog"], ["Members", "librarian.html#members"]];
  const adminLinks = [["Dashboard", "admin.html"], ["Users & Roles", "admin.html#users"], ["E-books", "admin.html#catalog"], ["Reports", "admin.html#reports"], ["Analytics", "admin.html#analytics"], ["Audit Logs", "admin.html#audit"]];
  const links = role === "Member" ? memberLinks : role === "Librarian" ? librarianLinks : role === "Admin" ? adminLinks : publicLinks;

  const activeFor = (href) => {
    const [page, hash = ""] = href.split("#");
    return page === currentPage && (hash ? window.location.hash.toLowerCase() === `#${hash}` : !window.location.hash);
  };
  const profileHref = role === "Member" ? "member.html#profile" : role === "Librarian" ? "librarian.html#profile" : "admin.html#profile";

  let notificationsList = [];
  let unreadCount = 0;

  // ─────────────────────────────────────────────────────────────
  // Dynamic Notifications Loader
  // ─────────────────────────────────────────────────────────────
  async function fetchNotifications() {
    if (!isAuth || !window.API || !window.API.getNotifications) return;
    try {
      const res = await window.API.getNotifications();
      if (res && res.success) {
        notificationsList = Array.isArray(res.data) ? res.data : [];
        unreadCount = Number(res.unreadCount) || 0;
        updateNotificationUI();
      }
    } catch (err) {
      console.warn("Could not fetch notifications:", err);
    }
  }

  function updateNotificationUI() {
    const notifBtn = header.querySelector("[data-notifications]");
    const popover = header.querySelector("#notifications-popover");
    if (!notifBtn || !popover) return;

    // Update or create badge
    let badge = notifBtn.querySelector(".nav-icon__badge");
    if (unreadCount > 0) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "nav-icon__badge";
        notifBtn.appendChild(badge);
      }
      badge.textContent = unreadCount > 9 ? "9+" : String(unreadCount);
    } else if (badge) {
      badge.remove();
    }

    // Render popover content
    if (!notificationsList.length) {
      popover.innerHTML = `
        <div class="popover-header">
          <strong>Notifications</strong>
        </div>
        <p class="notif-empty">No notifications yet. You're completely up to date!</p>
      `;
      return;
    }

    const typeIcons = {
      welcome: "👋",
      info: "ℹ️",
      system: "⚙️",
      recommendation: "✦",
      alert: "⚠️"
    };

    popover.innerHTML = `
      <div class="popover-header">
        <strong>Notifications ${unreadCount > 0 ? `(${unreadCount})` : ""}</strong>
        ${unreadCount > 0 ? `<button type="button" class="notif-mark-all-btn" data-mark-all-read>Mark all read</button>` : ""}
      </div>
      <div class="popover-list">
        ${notificationsList.map(item => {
          const icon = typeIcons[item.NotificationType] || "🔔";
          const dateStr = item.SentDate ? new Date(item.SentDate).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
          const isUnread = item.IsRead === 0;
          return `
            <div class="notif-item ${isUnread ? "is-unread" : ""}" data-notif-id="${item.NotificationID}">
              <span class="notif-icon">${icon}</span>
              <div class="notif-content">
                <p class="notif-message">${escapeHtml(item.Message)}</p>
                <time class="notif-time">${dateStr}</time>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;

    // Bind mark all read
    const markAllBtn = popover.querySelector("[data-mark-all-read]");
    if (markAllBtn) {
      markAllBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (window.API.markAllNotificationsRead) {
          await window.API.markAllNotificationsRead();
          unreadCount = 0;
          notificationsList.forEach(n => n.IsRead = 1);
          updateNotificationUI();
        }
      });
    }

    // Bind individual read
    popover.querySelectorAll(".notif-item.is-unread").forEach(elem => {
      elem.addEventListener("click", async () => {
        const id = elem.dataset.notifId;
        if (!id) return;
        elem.classList.remove("is-unread");
        unreadCount = Math.max(0, unreadCount - 1);
        const item = notificationsList.find(n => String(n.NotificationID) === id);
        if (item) item.IsRead = 1;
        updateNotificationUI();
        if (window.API.markNotificationRead) {
          await window.API.markNotificationRead(id).catch(() => {});
        }
      });
    });
  }

  function escapeHtml(val) {
    return String(val ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]);
  }

  // ─────────────────────────────────────────────────────────────
  // Header Rendering
  // ─────────────────────────────────────────────────────────────
  function renderHeader() {
    const currentHash = window.location.hash.toLowerCase();
    const linkMarkup = links.map(([label, href]) => `<a class="nav-link" href="${href}"${activeFor(href) ? ' aria-current="page"' : ""}>${label}</a>`).join("");
    const memberReadingActive = role === "Member" && (currentHash === "#history" || currentHash === "#bookmarks");
    const readingMarkup = role === "Member" ? `
      <div class="nav-dropdown">
        <button class="nav-dropdown__toggle" type="button" aria-expanded="false" aria-controls="reading-menu"${memberReadingActive ? ' aria-current="page"' : ""}>Reading <span aria-hidden="true">⌄</span></button>
        <div class="nav-dropdown__menu" id="reading-menu">
          <a href="member.html#history"${currentHash === "#history" ? ' aria-current="page"' : ""}>History</a>
          <a href="member.html#bookmarks"${currentHash === "#bookmarks" ? ' aria-current="page"' : ""}>Bookmarks</a>
        </div>
      </div>` : role === "Librarian" ? `
      <div class="nav-dropdown">
        <button class="nav-dropdown__toggle" type="button" aria-expanded="false" aria-controls="catalog-menu"${currentHash === "#catalog" || currentHash === "#add-ebook" ? ' aria-current="page"' : ""}>Catalog <span aria-hidden="true">⌄</span></button>
        <div class="nav-dropdown__menu" id="catalog-menu">
          <a href="librarian.html#catalog"${currentHash === "#catalog" ? ' aria-current="page"' : ""}>E-books</a>
          <a href="librarian.html#add-ebook"${currentHash === "#add-ebook" ? ' aria-current="page"' : ""}>Add E-book</a>
        </div>
      </div>` : "";
    const profileActive = role && activeFor(profileHref);
    const bell = `<button class="nav-icon" type="button" data-notifications aria-expanded="false" aria-controls="notifications-popover" aria-label="Open notifications"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M10 21h4"></path></svg></button>`;
    const actionMarkup = role ? `${bell}<a class="nav-profile" href="${profileHref}"${profileActive ? ' aria-current="page"' : ""}>Profile (${escapeHtml(username)})</a><button class="nav-logout" type="button" data-logout>Sign Out</button>` : `<a class="nav-login" href="login.html">Sign In</a>`;
    const popoverMarkup = role ? `<div class="nav-popover" id="notifications-popover" role="status" hidden></div>` : "";

    header.dataset.menuOpen = "false";
    header.innerHTML = `
      <nav class="top-nav" aria-label="Primary navigation">
        <a class="brand" href="index.html" aria-label="Digital Library home">
          <span class="brand__mark" aria-hidden="true">D</span>
          <span class="brand__name">Digital Library</span>
        </a>
        <div class="nav-links" id="primary-navigation">${linkMarkup}${readingMarkup}</div>
        <div class="nav-actions">${actionMarkup}</div>
        <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-navigation">
          <span class="nav-toggle__icon" aria-hidden="true"></span>
          <span class="sr-only">Open navigation</span>
        </button>
      </nav>
      ${popoverMarkup}
    `;

    bindHeaderControls();
    if (role) fetchNotifications();
  }

  function bindHeaderControls() {
    const toggle = header.querySelector(".nav-toggle");
    const setMenu = (open) => {
      header.dataset.menuOpen = String(open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.querySelector(".sr-only").textContent = open ? "Close navigation" : "Open navigation";
    };
    if (toggle) toggle.addEventListener("click", () => setMenu(header.dataset.menuOpen !== "true"));
    header.querySelectorAll(".nav-links a, .nav-profile").forEach((link) => link.addEventListener("click", () => setMenu(false)));

    const readingToggle = header.querySelector(".nav-dropdown__toggle");
    if (readingToggle) {
      readingToggle.addEventListener("click", () => {
        const open = readingToggle.getAttribute("aria-expanded") !== "true";
        readingToggle.setAttribute("aria-expanded", String(open));
        readingToggle.parentElement.classList.toggle("is-open", open);
      });
    }

    const notificationButton = header.querySelector("[data-notifications]");
    const popover = header.querySelector("#notifications-popover");
    if (notificationButton && popover) {
      notificationButton.addEventListener("click", (e) => {
        e.stopPropagation();
        const open = popover.hidden;
        popover.hidden = !open;
        notificationButton.setAttribute("aria-expanded", String(open));
        if (open) updateNotificationUI();
      });
      document.addEventListener("click", (e) => {
        if (!popover.contains(e.target) && !notificationButton.contains(e.target)) {
          popover.hidden = true;
          notificationButton.setAttribute("aria-expanded", "false");
        }
      });
    }

    const logoutBtn = header.querySelector("[data-logout]");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        if (window.API) {
          window.API.clearToken();
          window.location.href = "index.html";
        }
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Professional Multi-Column Footer Rendering
  // ─────────────────────────────────────────────────────────────
  function renderFooter() {
    let footer = document.querySelector(".site-footer");
    if (!footer) {
      footer = document.createElement("footer");
      footer.className = "site-footer";
      document.body.appendChild(footer);
    }

    footer.innerHTML = `
      <div class="container">
        <div class="footer-inner">
          <!-- Col 1: Brand & Mission -->
          <div class="footer-brand-col">
            <a class="footer-brand" href="index.html">
              <span class="brand__mark">D</span>
              <span>Digital Library</span>
            </a>
            <p class="footer-mission">A considered open archive connecting inquisitive readers with classical literature, modern disciplines, and transparent machine learning suggestions.</p>
            <div class="footer-system-status" data-footer-status title="System is operational">
              <span class="status-dot-pulse"></span>
              <span>AI Recommendation Engine: Online</span>
            </div>
            <div class="footer-stats-badges">
              <span class="footer-stat-chip"><strong data-footer-books>20</strong> Titles</span>
              <span class="footer-stat-chip"><strong data-footer-categories>10</strong> Subjects</span>
              <span class="footer-stat-chip"><strong>14</strong> Members</span>
              <span class="footer-stat-chip"><strong>MySQL</strong> Active</span>
            </div>
          </div>

          <!-- Col 2: Explore & Read -->
          <div class="footer-links-col">
            <h4 class="footer-col-title">Explore</h4>
            <div class="footer-link-list">
              <a class="footer-link" href="index.html">Discover Catalogue</a>
              <a class="footer-link" href="index.html#spotlight-title">Smart Suggestions <span class="footer-badge-tag">AI</span></a>
              <a class="footer-link" href="index.html#category-title">Subject Shelves</a>
              <a class="footer-link" href="reader.html?id=1">In-Browser Reader</a>
              <a class="footer-link" href="index.html#catalogue-search">Catalogue Search</a>
            </div>
          </div>

          <!-- Col 3: Workspaces & Portals -->
          <div class="footer-links-col">
            <h4 class="footer-col-title">Workspaces</h4>
            <div class="footer-link-list">
              <a class="footer-link" href="member.html">Member Reading Desk</a>
              <a class="footer-link" href="member.html#bookmarks">Saved Bookmarks</a>
              <a class="footer-link" href="member.html#history">Reading History</a>
              <a class="footer-link" href="librarian.html">Librarian Cataloguer</a>
              <a class="footer-link" href="admin.html">Admin Command Suite</a>
              <a class="footer-link" href="login.html">Sign In Portal</a>
            </div>
          </div>

          <!-- Col 4: Newsletter & Formats -->
          <div class="footer-newsletter-col">
            <h4 class="footer-col-title">Curator's Dispatch</h4>
            <p class="footer-newsletter-text">Receive thoughtful updates when newly scanned classics and scholarly editions enter the archive.</p>
            <form class="footer-newsletter-form" data-newsletter-form>
              <label class="sr-only" for="footer-email">Your email address</label>
              <input class="footer-newsletter-input" id="footer-email" type="email" placeholder="reader@library.org" required autocomplete="email" />
              <button class="footer-newsletter-btn" type="submit">Subscribe</button>
            </form>
            <span class="footer-newsletter-feedback" data-newsletter-feedback role="status"></span>
            <div class="footer-tech-chips">
              <span class="footer-tech-tag">EPUB 3.0</span>
              <span class="footer-tech-tag">PDF</span>
              <span class="footer-tech-tag">TF-IDF Vector Space</span>
              <span class="footer-tech-tag">Open Standards</span>
            </div>
          </div>
        </div>

        <!-- Sub-footer Bar -->
        <div class="footer-sub">
          <span>&copy; 2026 Digital Library Portal. Engineered for timeless reading &amp; open knowledge.</span>
          <div class="footer-sub-links">
            <a class="footer-link" href="index.html#collection-note-title">About Archive</a>
            <a class="footer-link" href="index.html">Privacy &amp; Data</a>
            <button class="footer-back-to-top" type="button" data-back-to-top aria-label="Scroll back to top">
              <span>↑ Top</span>
            </button>
          </div>
        </div>
      </div>
    `;

    // Bind newsletter submit
    const nForm = footer.querySelector("[data-newsletter-form]");
    const nFeedback = footer.querySelector("[data-newsletter-feedback]");
    if (nForm && nFeedback) {
      nForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = nForm.querySelector("input[type='email']");
        const val = input.value.trim();
        if (!val || !val.includes("@")) {
          nFeedback.className = "footer-newsletter-feedback is-error";
          nFeedback.textContent = "Please provide a valid email address.";
          return;
        }
        try {
          const subs = JSON.parse(localStorage.getItem("libraryNewsletterSubs") || "[]");
          subs.push({ email: val, date: new Date().toISOString() });
          localStorage.setItem("libraryNewsletterSubs", JSON.stringify(subs));
        } catch (err) {}
        nFeedback.className = "footer-newsletter-feedback";
        nFeedback.textContent = "✓ Subscribed! You will receive new book dispatches.";
        input.value = "";
        setTimeout(() => { nFeedback.textContent = ""; }, 6000);
      });
    }

    // Bind back-to-top
    const backToTopBtn = footer.querySelector("[data-back-to-top]");
    if (backToTopBtn) {
      backToTopBtn.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    // Fetch live statistics in the background
    updateFooterDynamicStats(footer);
  }

  async function updateFooterDynamicStats(footer) {
    try {
      const bRes = await fetch("/api/books?limit=1").then(r => r.json()).catch(() => null);
      if (bRes && bRes.pagination && bRes.pagination.total) {
        const el = footer.querySelector("[data-footer-books]");
        if (el) el.textContent = bRes.pagination.total;
      }
      const cRes = await fetch("/api/categories").then(r => r.json()).catch(() => null);
      if (cRes && Array.isArray(cRes.data)) {
        const el = footer.querySelector("[data-footer-categories]");
        if (el) el.textContent = cRes.data.length;
      }
      const mRes = await fetch("/api/recommendations/model-info").then(r => r.json()).catch(() => null);
      if (mRes && mRes.success && mRes.model) {
        const st = footer.querySelector("[data-footer-status]");
        if (st) {
          st.innerHTML = `<span class="status-dot-pulse"></span><span>AI Model: ${mRes.model.vocabularySize || 0} terms synced</span>`;
        }
      }
    } catch (e) {
      // Keep defaults
    }
  }

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    header.dataset.menuOpen = "false";
    header.querySelector(".nav-toggle")?.setAttribute("aria-expanded", "false");
    header.querySelector(".nav-toggle .sr-only")?.replaceChildren(document.createTextNode("Open navigation"));
    const popover = header.querySelector("#notifications-popover");
    const notificationButton = header.querySelector("[data-notifications]");
    if (popover) {
      popover.hidden = true;
      notificationButton?.setAttribute("aria-expanded", "false");
    }
  });

  window.addEventListener("hashchange", renderHeader);
  window.addEventListener("resize", () => {
    if (window.innerWidth > 768) {
      header.dataset.menuOpen = "false";
      header.querySelector(".nav-toggle")?.setAttribute("aria-expanded", "false");
    }
  });

  renderHeader();
  renderFooter();
});
