"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const validViews = new Set(["dashboard", "users", "catalog", "payments", "reports", "exports", "analytics", "audit", "profile"]);
  const initialized = new Set();
  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]);
  const demoBooks = [
    { BookID: "admin-demo-1", Title: "The Shape of Ideas", Author: "Mira Sen", GenreName: "Design", CategoryID: "Design", Format: "EPUB", ISBN: "978000000001", Publisher: "North House", AccessCount: 18, Description: "A quiet study of how ideas become visible in the spaces we make." },
    { BookID: "admin-demo-2", Title: "Field Notes on Attention", Author: "Jon Bell", GenreName: "Psychology", CategoryID: "Psychology", Format: "PDF", ISBN: "978000000002", Publisher: "Common Room", AccessCount: 11, Description: "Short essays on focus, distraction, and the value of looking closely." },
    { BookID: "admin-demo-3", Title: "A Brief Atlas of Light", Author: "Nora Hale", GenreName: "Science", CategoryID: "Science", Format: "EPUB", ISBN: "978000000003", Publisher: "Field Press", AccessCount: 27, Description: "An accessible journey through the physics and poetry of light." },
    { BookID: "admin-demo-4", Title: "Cities for Listening", Author: "Ari Okafor", GenreName: "Architecture", CategoryID: "Architecture", Format: "PDF", ISBN: "978000000004", Publisher: "Civic Editions", AccessCount: 8, Description: "The sounds, rhythms, and hidden conversations that shape urban life." },
  ];
  const demoMembers = [
    { MemberID: "admin-member-1", UserID: "admin-user-1", Username: "aarav", Email: "aarav@example.test", FullName: "Aarav Mehta", SubscriptionTier: "Premium", RegistrationDate: "2026-01-12", LastActiveDate: "2026-09-20", Department: "Information Technology", IsActive: 1 },
    { MemberID: "admin-member-2", UserID: "admin-user-2", Username: "sana", Email: "sana@example.test", FullName: "Sana Iyer", SubscriptionTier: "Free", RegistrationDate: "2026-03-07", LastActiveDate: "2026-09-18", Department: "Computer Science", IsActive: 1 },
    { MemberID: "admin-member-3", UserID: "admin-user-3", Username: "kabir", Email: "kabir@example.test", FullName: "Kabir Shah", SubscriptionTier: "Free", RegistrationDate: "2026-05-21", LastActiveDate: "2026-09-11", Department: "Design", IsActive: 0 },
  ];
  const categories = [{ CategoryID: "Design", GenreName: "Design", BookCount: 1 }, { CategoryID: "Psychology", GenreName: "Psychology", BookCount: 1 }, { CategoryID: "Science", GenreName: "Science", BookCount: 1 }, { CategoryID: "Architecture", GenreName: "Architecture", BookCount: 1 }];
  const activity = [{ date: "2026-09-22 14:30", user: "Priya Nair", action: "Updated", entity: "EBooks / Shape of Ideas", result: "Success" }, { date: "2026-09-21 10:12", user: "Admin workspace", action: "Reviewed", entity: "Member records", result: "Success" }, { date: "2026-09-19 16:45", user: "Priya Nair", action: "Added", entity: "EBooks / Atlas of Light", result: "Success" }];

  /* ─── API Helper ─── */
  const getJson = async (url, options = {}) => {
    const token = (typeof window !== "undefined" && window.API) ? window.API.getToken() : null;
    const headers = { "Content-Type": "application/json", ...options.headers };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const response = await fetch(url, { ...options, headers });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) throw new Error(payload.message || "The library service is unavailable.");
    return payload;
  };

  /* ─── Helpers ─── */
  const state = (container, title, message) => { container.innerHTML = `<div class="state-block"><div><strong>${esc(title)}</strong><span>${esc(message)}</span></div></div>`; };
  const idOf = (book) => String(book.BookID ?? book.bookId ?? "");
  const titleOf = (book) => book.Title || book.title || "Untitled book";

  /* ─── Table Renderers ─── */
  const tableBooks = (books) => !books.length ? `<div class="state-block"><div><strong>No books found.</strong><span>Try another search or category.</span></div></div>` : `<table class="data-table"><thead><tr><th>Title</th><th>Author</th><th>Category</th><th>Format</th><th>Status</th><th></th></tr></thead><tbody>${books.map((book) => `<tr><td><div class="table-title">${esc(titleOf(book))}</div><div class="table-meta">${esc(book.ISBN || "ISBN unavailable")}</div></td><td>${esc(book.Author)}</td><td>${esc(book.GenreName || "Uncategorized")}</td><td>${esc(book.Format || "Digital")}</td><td><span class="table-meta">Available</span></td><td><button class="table-action" type="button" data-admin-book-detail="${esc(idOf(book))}">Details</button> <button class="table-action" type="button" data-admin-book-edit="${esc(idOf(book))}">Edit</button> <button class="table-action danger-button" type="button" data-admin-book-delete="${esc(idOf(book))}">Delete</button></td></tr>`).join("")}</tbody></table>`;
  const tableMembers = (members) => !members.length ? `<div class="state-block"><div><strong>No members found.</strong><span>No records match this search.</span></div></div>` : `<table class="data-table"><thead><tr><th>Member</th><th>Role</th><th>Plan</th><th>Status</th><th>Last active</th><th></th></tr></thead><tbody>${members.map((member) => `<tr><td><div class="table-title">${esc(member.FullName || member.Username)}</div><div class="table-meta">${esc(member.Email)}</div></td><td>Member</td><td>${esc(member.SubscriptionTier || "—")}</td><td>${member.IsActive === 0 ? "Inactive" : "Active"}</td><td>${esc(member.LastActiveDate || "—")}</td><td><button class="table-action" type="button" data-admin-member-detail="${esc(member.MemberID)}">Details</button> <button class="table-action danger-button" type="button" data-admin-member-deactivate="${esc(member.UserID)}"${member.IsActive === 0 ? " disabled" : ""}>Deactivate</button></td></tr>`).join("")}</tbody></table>`;
  const tableActivity = (items) => !items.length ? `<div class="state-block"><div><strong>No activity recorded.</strong><span>System audit logs will appear here.</span></div></div>` : `<table class="data-table"><thead><tr><th>Date/time</th><th>User</th><th>Action</th><th>Entity / Details</th><th>Result</th></tr></thead><tbody>${items.map((item) => `<tr><td>${esc(item.date)}</td><td>${esc(item.user)}</td><td>${esc(item.action)}</td><td>${esc(item.entity)}</td><td><span class="badge ${item.result === 'Success' ? 'badge--success' : ''}">${esc(item.result)}</span></td></tr>`).join("")}</tbody></table>`;
  const tableReportFiles = (list) => !list.length ? `<div class="state-block"><div><strong>No generated reports yet.</strong><span>Click an export button to create your first report.</span></div></div>` : `<table class="data-table"><thead><tr><th>Report Name</th><th>Type</th><th>Generated By</th><th>Date</th><th>Action</th></tr></thead><tbody>${list.map(r => `<tr><td><div class="table-title">${esc(r.ReportName)}</div></td><td>${esc(r.ReportType || "Analytics")}</td><td>${esc(r.GeneratedByName || "Admin")}</td><td>${esc(new Date(r.GenerationDate).toLocaleString())}</td><td><button class="table-action button button--quiet" type="button" data-download-report="${esc(r.ReportID)}" data-report-name="${esc(r.ReportName)}">Download CSV</button></td></tr>`).join("")}</tbody></table>`;

  /* ─── Modals ─── */
  function modal(markup) { const existing = document.querySelector("[data-admin-modal]"); if (existing) existing.remove(); document.body.insertAdjacentHTML("beforeend", `<div class="book-modal" data-admin-modal><div class="book-modal__backdrop" data-admin-close></div><section class="book-modal__surface member-modal__details" role="dialog" aria-modal="true">${markup}</section></div>`); const element = document.querySelector("[data-admin-modal]"); element.querySelectorAll("[data-admin-close]").forEach((button) => button.addEventListener("click", () => element.remove())); return element; }
  async function loadBooks({ page = 1, search = "", category = "", limit = 8 } = {}) { const payload = await getJson(`/api/books?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}`); return payload; }
  async function loadMembers() { return (await getJson("/api/members")).data || []; }
  function bookDetails(book) { const element = modal(`<button class="book-modal__close" type="button" data-admin-close aria-label="Close book details">×</button><p class="eyebrow">Book details</p><h2 class="book-modal__title">${esc(titleOf(book))}</h2><p class="book-modal__author">${esc(book.Author)}</p><p class="book-modal__description">${esc(book.Description || "No description available.")}</p><dl class="book-modal__metadata"><div><dt>Format</dt><dd>${esc(book.Format)}</dd></div><div><dt>ISBN</dt><dd>${esc(book.ISBN)}</dd></div><div><dt>Publisher</dt><dd>${esc(book.Publisher)}</dd></div><div><dt>Accesses</dt><dd>${esc(book.AccessCount ?? "—")}</dd></div></dl>`); return element; }
  function editBook(book) { const element = modal(`<button class="book-modal__close" type="button" data-admin-close aria-label="Close edit form">×</button><p class="eyebrow">Catalogue metadata</p><h2 class="book-modal__title">Edit e-book</h2><form data-admin-edit-form><label class="field"><span>Title</span><input name="title" value="${esc(book.Title)}" required></label><label class="field"><span>Author</span><input name="author" value="${esc(book.Author)}" required></label><label class="field"><span>Publisher</span><input name="publisher" value="${esc(book.Publisher)}"></label><label class="field"><span>Category ID</span><input name="categoryId" value="${esc(book.CategoryID)}"></label><label class="field"><span>Description</span><textarea name="description" rows="4">${esc(book.Description)}</textarea></label><div class="form-actions"><button class="button button--primary" type="submit">Save changes</button><span class="form-feedback" data-admin-feedback role="status"></span></div></form>`); element.querySelector("form").addEventListener("submit", async (event) => { event.preventDefault(); const feedback = element.querySelector("[data-admin-feedback]"); feedback.textContent = "Saving…"; try { const payload = await getJson(`/api/books/${encodeURIComponent(idOf(book))}`, { method: "PUT", body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())) }); feedback.className = "form-feedback is-success"; feedback.textContent = payload.message || "Book updated successfully."; } catch (error) { feedback.className = "form-feedback is-error"; feedback.textContent = error.message; } }); }
  function addBook() { const element = modal(`<button class="book-modal__close" type="button" data-admin-close aria-label="Close add form">×</button><p class="eyebrow">Catalogue</p><h2 class="book-modal__title">Add e-book</h2><form data-admin-add-form><div class="form-grid"><label class="field"><span>Title</span><input name="title" required></label><label class="field"><span>Author</span><input name="author" required></label><label class="field"><span>ISBN</span><input name="isbn" required></label><label class="field"><span>Category ID</span><input name="categoryId" required></label><label class="field"><span>Format</span><input name="format" required></label><label class="field"><span>File path</span><input name="filePath" required></label><label class="field"><span>File size (MB)</span><input name="fileSize" type="number" step=".01" required></label></div><div class="form-actions"><button class="button button--primary" type="submit">Create record</button><span class="form-feedback" data-admin-feedback role="status"></span></div></form>`); element.querySelector("form").addEventListener("submit", async (event) => { event.preventDefault(); const feedback = element.querySelector("[data-admin-feedback]"); feedback.textContent = "Saving…"; try { const data = Object.fromEntries(new FormData(event.currentTarget).entries()); data.fileSize = Number(data.fileSize); const payload = await getJson("/api/books", { method: "POST", body: JSON.stringify(data) }); feedback.className = "form-feedback is-success"; feedback.textContent = payload.message || "Book created successfully."; } catch (error) { feedback.className = "form-feedback is-error"; feedback.textContent = error.message; } }); }

  /* ─── System Health Check ─── */
  async function checkSystemHealth() {
    const checks = [
      { key: "api", url: "/api/health" },
      { key: "db", url: "/api/audit/dashboard" },
      { key: "ai", url: "/api/recommendations/model-info" }
    ];
    for (const check of checks) {
      const chip = document.querySelector(`[data-health="${check.key}"]`);
      if (!chip) continue;
      const statusEl = chip.querySelector(".health-status");
      try {
        await getJson(check.url);
        chip.classList.add("is-online");
        chip.classList.remove("is-offline");
        statusEl.textContent = "Online";
      } catch {
        chip.classList.add("is-offline");
        chip.classList.remove("is-online");
        statusEl.textContent = "Offline";
      }
    }
  }

  /* ─── Animated Counter ─── */
  function animateCounter(element, target) {
    const num = parseInt(target);
    if (isNaN(num)) { element.textContent = target; return; }
    let current = 0;
    const step = Math.max(1, Math.ceil(num / 30));
    const interval = setInterval(() => {
      current += step;
      if (current >= num) { current = num; clearInterval(interval); }
      element.textContent = current.toLocaleString();
    }, 30);
  }

  /* ═══════ DASHBOARD ═══════ */
  async function dashboard() {
    const booksTarget = document.querySelector("[data-admin-books]"),
          activityTarget = document.querySelector("[data-admin-activity]");

    // System health
    checkSystemHealth();

    // Load stats
    try {
      const statsPayload = await getJson("/api/audit/dashboard");
      if (statsPayload.data) {
        animateCounter(document.querySelector("[data-admin-book-count]"), statsPayload.data.totalBooks ?? "—");
        animateCounter(document.querySelector("[data-admin-member-count]"), statsPayload.data.totalMembers ?? "—");
        animateCounter(document.querySelector("[data-admin-session-count]"), statsPayload.data.activeSessions ?? "0");
        animateCounter(document.querySelector("[data-admin-premium-count]"), statsPayload.data.premiumMembers ?? "0");
        
        // Trend indicators
        if (statsPayload.data.recentBooks > 0) {
          const trend = document.querySelector('[data-stat-trend="books"]');
          if (trend) { trend.className = "stat-card__trend is-up"; trend.textContent = `↑ ${statsPayload.data.recentBooks} new this month`; }
        }
      }
    } catch {
      try {
        const payload = await loadBooks({ limit: 5 });
        animateCounter(document.querySelector("[data-admin-book-count]"), payload.pagination?.total ?? payload.data?.length ?? 0);
      } catch {
        document.querySelector("[data-admin-book-count]").textContent = "—";
      }
      try {
        const members = await loadMembers();
        animateCounter(document.querySelector("[data-admin-member-count]"), members.length);
      } catch {
        document.querySelector("[data-admin-member-count]").textContent = demoMembers.length;
      }
      document.querySelector("[data-admin-session-count]").textContent = "—";
      document.querySelector("[data-admin-premium-count]").textContent = "—";
    }

    // Load books table
    try {
      const booksPayload = await loadBooks({ limit: 5 });
      booksTarget.innerHTML = tableBooks(booksPayload.data || []);
    } catch {
      booksTarget.innerHTML = tableBooks(demoBooks);
      booksTarget.insertAdjacentHTML("beforebegin", '<span class="demo-note">Local demonstration catalogue · API unavailable</span>');
    }

    // Load activity
    try {
      const auditPayload = await getJson("/api/audit?limit=5");
      const logs = auditPayload.data || [];
      if (logs.length) {
        activityTarget.innerHTML = tableActivity(logs.map(l => ({
          date: new Date(l.Timestamp).toLocaleString(),
          user: l.Username || (l.UserID ? `User #${l.UserID}` : "System"),
          action: l.ActionType || "EVENT",
          entity: l.ActionDetails || (l.EntityType ? `${l.EntityType} #${l.EntityID || ''}` : "—"),
          result: (l.StatusCode && l.StatusCode < 400) ? "Success" : "Recorded"
        })));
      } else {
        activityTarget.innerHTML = tableActivity(activity);
      }
    } catch {
      activityTarget.innerHTML = tableActivity(activity);
    }
  }

  /* ═══════ USERS ═══════ */
  async function users() { const table = document.querySelector("[data-admin-users]"), search = document.querySelector("[data-admin-user-search]"), summary = document.querySelector("[data-admin-user-summary]"); let members; try { members = await loadMembers(); } catch { members = demoMembers; table.insertAdjacentHTML("beforebegin", '<span class="demo-note">Local demonstration members · API unavailable</span>'); } const render = () => { const query = search.value.trim().toLowerCase(); const filtered = members.filter((member) => `${member.FullName} ${member.Username} ${member.Email}`.toLowerCase().includes(query)); summary.textContent = `${filtered.length} member${filtered.length === 1 ? "" : "s"}`; table.innerHTML = tableMembers(filtered); }; search.addEventListener("input", render); render(); }

  /* ═══════ CATALOG ═══════ */
  async function catalog() { const table = document.querySelector("[data-admin-catalog-table]"), search = document.querySelector("[data-admin-book-search]"), category = document.querySelector("[data-admin-category]"), summary = document.querySelector("[data-admin-book-summary]"), note = document.querySelector("[data-admin-catalog-note]"), pagination = document.querySelector("[data-admin-pagination]"); let live = true; try { const cats = await getJson("/api/categories"); (cats.data || categories).forEach((item) => { const option = document.createElement("option"); option.value = item.CategoryID; option.textContent = item.GenreName; category.append(option); }); } catch { categories.forEach((item) => { const option = document.createElement("option"); option.value = item.CategoryID; option.textContent = item.GenreName; category.append(option); }); } let page = 1; const render = async () => { table.innerHTML = '<div class="state-block"><span class="state-spinner"></span><span>Loading e-books…</span></div>'; let books, pages = 1; try { const payload = await loadBooks({ page, search: search.value.trim(), category: category.value }); books = payload.data || []; pages = payload.pagination?.pages || 1; } catch { live = false; books = demoBooks.filter((book) => (!search.value || `${book.Title} ${book.Author} ${book.ISBN}`.toLowerCase().includes(search.value.toLowerCase())) && (!category.value || book.CategoryID === category.value)); if (note) note.hidden = false; } summary.textContent = `${books.length} visible title${books.length === 1 ? "" : "s"}`; table.innerHTML = tableBooks(books); pagination.innerHTML = pages > 1 ? Array.from({ length: Math.min(pages, 8) }, (_, index) => `<button type="button" data-admin-page="${index + 1}" aria-current="${index + 1 === page ? "page" : "false"}">${index + 1}</button>`).join("") : ""; }; let timer; [search, category].forEach((item) => item.addEventListener("input", () => { page = 1; clearTimeout(timer); timer = setTimeout(render, 180); })); document.querySelector("[data-admin-reset]").addEventListener("click", () => { search.value = ""; category.value = ""; page = 1; render(); }); document.querySelector("[data-admin-add]").addEventListener("click", addBook); pagination.addEventListener("click", (event) => { const button = event.target.closest("[data-admin-page]"); if (button) { page = Number(button.dataset.adminPage); render(); } }); render(); }

  /* ═══════ ANALYTICS ═══════ */
  async function analytics() {
    try {
      const [catsRes, dashRes, booksRes] = await Promise.allSettled([
        getJson("/api/categories"),
        getJson("/api/audit/dashboard"),
        getJson("/api/books?limit=100")
      ]);

      const catTarget = document.querySelector("[data-category-chart]");
      if (catTarget && catsRes.status === "fulfilled" && Array.isArray(catsRes.value.data)) {
        const catRows = catsRes.value.data
          .filter(c => (c.BookCount || 0) > 0)
          .slice(0, 6)
          .map(c => [c.GenreName, Math.min(100, (c.BookCount || 1) * 20), c.BookCount || 0]);
        if (catRows.length) {
          catTarget.innerHTML = catRows.map(([label, width, count]) => `<div class="bar-row"><span>${esc(label)}</span><span class="bar-track"><span class="bar-fill" style="width:${width}%"></span></span><strong>${count}</strong></div>`).join("");
        }
      }

      const fmtTarget = document.querySelector("[data-format-chart]");
      if (fmtTarget && booksRes.status === "fulfilled" && Array.isArray(booksRes.value.data)) {
        const counts = {};
        booksRes.value.data.forEach(b => {
          const fmt = b.Format || "PDF";
          counts[fmt] = (counts[fmt] || 0) + 1;
        });
        const total = booksRes.value.data.length || 1;
        const fmtRows = Object.entries(counts).map(([fmt, cnt]) => [fmt, Math.round((cnt / total) * 100), cnt]);
        if (fmtRows.length) {
          fmtTarget.innerHTML = fmtRows.map(([label, pct, cnt]) => `<div class="bar-row"><span>${esc(label)}</span><span class="bar-track"><span class="bar-fill bar-fill--lavender" style="width:${pct}%"></span></span><strong>${cnt} (${pct}%)</strong></div>`).join("");
        }
      }

      const actTarget = document.querySelector("[data-activity-chart]");
      if (actTarget && dashRes.status === "fulfilled" && dashRes.value.data) {
        const d = dashRes.value.data;
        const actRows = [
          ["Active Members", Math.min(100, (d.totalMembers || 0) * 10), d.totalMembers || 0],
          ["Premium Tier", Math.min(100, (d.premiumMembers || 0) * 20), d.premiumMembers || 0],
          ["Active Sessions", Math.min(100, (d.activeSessions || 0) * 15), d.activeSessions || 0],
          ["Catalogue Titles", Math.min(100, (d.totalBooks || 0) * 5), d.totalBooks || 0]
        ];
        actTarget.innerHTML = actRows.map(([label, pct, val]) => `<div class="bar-row"><span>${esc(label)}</span><span class="bar-track"><span class="bar-fill" style="width:${pct}%"></span></span><strong>${val}</strong></div>`).join("");
      }

      // Engagement chart — new
      const engTarget = document.querySelector("[data-engagement-chart]");
      if (engTarget && dashRes.status === "fulfilled" && dashRes.value.data) {
        const d = dashRes.value.data;
        const freeMembers = (d.totalMembers || 0) - (d.premiumMembers || 0);
        const conversionRate = d.totalMembers ? Math.round((d.premiumMembers / d.totalMembers) * 100) : 0;
        const engRows = [
          ["Free Members", Math.min(100, freeMembers * 10), freeMembers],
          ["Premium Members", Math.min(100, (d.premiumMembers || 0) * 10), d.premiumMembers || 0],
          ["Conversion Rate", conversionRate, `${conversionRate}%`],
          ["New Books (30d)", Math.min(100, (d.recentBooks || 0) * 10), d.recentBooks || 0]
        ];
        engTarget.innerHTML = engRows.map(([label, pct, val]) => `<div class="bar-row"><span>${esc(label)}</span><span class="bar-track"><span class="bar-fill bar-fill--lavender" style="width:${pct}%"></span></span><strong>${val}</strong></div>`).join("");
      }
    } catch (err) {
      console.warn("Analytics error:", err);
    }
  }

  /* ═══════ AUDIT ═══════ */
  async function audit() {
    const search = document.querySelector("[data-audit-search]"),
          table = document.querySelector("[data-audit-table]"),
          summary = document.querySelector("[data-audit-summary]");
    let logsList = activity;
    table.innerHTML = '<div class="state-block"><span class="state-spinner"></span><span>Loading audit logs…</span></div>';
    try {
      const payload = await getJson("/api/audit?limit=50");
      if (Array.isArray(payload.data) && payload.data.length) {
        logsList = payload.data.map(l => ({
          date: new Date(l.Timestamp).toLocaleString(),
          user: l.Username || (l.UserID ? `User #${l.UserID}` : "System"),
          action: l.ActionType || "EVENT",
          entity: l.ActionDetails || (l.EntityType ? `${l.EntityType} #${l.EntityID || ''}` : "—"),
          result: (l.StatusCode && l.StatusCode < 400) ? "Success" : "Recorded"
        }));
      }
    } catch (err) {
      console.warn("Could not load real audit logs:", err);
    }
    const render = () => {
      const query = search.value.toLowerCase();
      const filtered = logsList.filter(item => `${item.user} ${item.action} ${item.entity}`.toLowerCase().includes(query));
      summary.textContent = `${filtered.length} records`;
      table.innerHTML = tableActivity(filtered);
    };
    search.addEventListener("input", render);
    render();
  }

  /* ═══════ REPORTS ═══════ */
  async function reports() {
    const reportsTable = document.querySelector("[data-admin-reports-table]");
    const readingBtn = document.querySelector('[data-generate-report="reading"]');
    const auditBtn = document.querySelector('[data-generate-report="audit"]');
    const refreshBtn = document.querySelector("[data-refresh-reports]");

    async function loadReportsList() {
      if (!reportsTable) return;
      reportsTable.innerHTML = '<div class="state-block"><span class="state-spinner"></span><span>Loading generated reports…</span></div>';
      try {
        const payload = await getJson("/api/reports");
        const list = payload.data || [];
        reportsTable.innerHTML = tableReportFiles(list);
      } catch (err) {
        reportsTable.innerHTML = `<div class="state-block"><div><strong>Could not fetch reports.</strong><span>${esc(err.message)}</span></div></div>`;
      }
    }

    async function triggerReport(type, btn, statusSelector) {
      const statusEl = document.querySelector(statusSelector);
      btn.disabled = true;
      if (statusEl) statusEl.textContent = "Generating report in database…";
      try {
        const payload = await getJson(`/api/reports/${type}`, { method: "POST" });
        if (statusEl) statusEl.textContent = `Generated: ${payload.filename || 'Report ready'}`;
        await loadReportsList();
      } catch (err) {
        if (statusEl) statusEl.textContent = `Failed: ${err.message}`;
      } finally {
        btn.disabled = false;
      }
    }

    if (readingBtn && !readingBtn.dataset.bound) {
      readingBtn.dataset.bound = "true";
      readingBtn.addEventListener("click", () => triggerReport("reading", readingBtn, '[data-report-status="reading"]'));
    }
    if (auditBtn && !auditBtn.dataset.bound) {
      auditBtn.dataset.bound = "true";
      auditBtn.addEventListener("click", () => triggerReport("audit", auditBtn, '[data-report-status="audit"]'));
    }
    if (refreshBtn && !refreshBtn.dataset.bound) {
      refreshBtn.dataset.bound = "true";
      refreshBtn.addEventListener("click", loadReportsList);
    }

    bindDownloadButtons(reportsTable);
    loadReportsList();
  }

  /* ═══════ EXPORTS CENTRE ═══════ */
  function triggerClientDownload(content, filename, type = "text/csv") {
    const blob = new Blob([content], { type });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 2000);
  }

  async function downloadExportFileDirectly(filename, reportId) {
    if (reportId && window.API?.downloadReport) {
      await window.API.downloadReport(reportId, filename);
      return;
    }
    const token = (typeof window !== "undefined" && window.API) ? window.API.getToken() : null;
    const res = await fetch(`/api/exports/download/${encodeURIComponent(filename)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!res.ok) throw new Error("Could not download export file");
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 2000);
  }

  async function exports() {
    const exportActions = {
      "books": "/api/exports/books",
      "members": "/api/exports/members",
      "reading": "/api/exports/reading",
      "audit": "/api/exports/audit",
      "access-logs": "/api/exports/access-logs",
      "search-history": "/api/exports/search-history",
      "notifications": "/api/exports/notifications",
      "payments": "/api/exports/payments",
      "system-summary": "/api/exports/system-summary"
    };

    // Bind export buttons
    document.querySelectorAll("[data-export-action]").forEach(btn => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = "true";
      btn.addEventListener("click", async () => {
        const type = btn.dataset.exportAction;
        const urlBase = exportActions[type];
        if (!urlBase) return;

        const formatRadio = document.querySelector('input[name="adminExportFormat"]:checked');
        const format = formatRadio ? formatRadio.value : "csv";

        const dateRangeSelect = document.querySelector("[data-export-date-range]");
        const dateRange = dateRangeSelect ? dateRangeSelect.value : "all";

        const params = new URLSearchParams({ format });
        if (dateRange === "today") {
          params.set("startDate", new Date().toISOString().split("T")[0]);
        } else if (dateRange === "7days") {
          params.set("startDate", new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0]);
        } else if (dateRange === "30days") {
          params.set("startDate", new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0]);
        }

        const statusEl = document.querySelector(`[data-export-status="${type}"]`);
        btn.disabled = true;
        const origText = btn.textContent;
        btn.textContent = "Exporting…";
        if (statusEl) {
          statusEl.className = "export-card__status is-loading";
          statusEl.textContent = "Generating file & saving to archive…";
        }

        try {
          const payload = await getJson(`${urlBase}?${params.toString()}`, { method: "POST" });
          const filename = payload.filename || `${type}_export.${format}`;

          // Trigger instant browser download
          if (payload.content) {
            triggerClientDownload(payload.content, filename, format === "json" ? "application/json" : "text/csv");
          } else if (payload.data && format === "json") {
            triggerClientDownload(JSON.stringify(payload.data, null, 2), filename, "application/json");
          } else if (payload.filename) {
            await downloadExportFileDirectly(payload.filename, payload.reportId);
          }

          if (statusEl) {
            statusEl.className = "export-card__status is-success";
            const countText = payload.recordsCount != null ? ` (${payload.recordsCount} records)` : "";
            statusEl.textContent = `Downloaded ${filename}${countText}`;
          }

          loadExportsHistory();
        } catch (err) {
          if (statusEl) {
            statusEl.className = "export-card__status is-error";
            statusEl.textContent = `Failed: ${err.message}`;
          }
        } finally {
          btn.disabled = false;
          btn.textContent = origText;
        }
      });
    });

    // Refresh button
    const refreshBtn = document.querySelector("[data-refresh-exports]");
    if (refreshBtn && !refreshBtn.dataset.bound) {
      refreshBtn.dataset.bound = "true";
      refreshBtn.addEventListener("click", loadExportsHistory);
    }

    loadExportsHistory();
  }

  async function loadExportsHistory() {
    const table = document.querySelector("[data-exports-history-table]");
    if (!table) return;
    table.innerHTML = '<div class="state-block"><span class="state-spinner"></span><span>Loading export history…</span></div>';
    try {
      const payload = await getJson("/api/reports");
      const list = payload.data || [];
      table.innerHTML = tableReportFiles(list);
      bindDownloadButtons(table);
    } catch (err) {
      table.innerHTML = `<div class="state-block"><div><strong>Could not fetch export history.</strong><span>${esc(err.message)}</span></div></div>`;
    }
  }

  /* ─── Download handler ─── */
  function bindDownloadButtons(container) {
    if (!container || container.dataset.dlBound) return;
    container.dataset.dlBound = "true";
    container.addEventListener("click", async (e) => {
      const dlBtn = e.target.closest("[data-download-report]");
      if (!dlBtn) return;
      const reportId = dlBtn.dataset.downloadReport;
      const reportName = dlBtn.dataset.reportName || "report.csv";
      try {
        dlBtn.disabled = true;
        dlBtn.textContent = "Downloading…";
        await downloadExportFileDirectly(reportName, reportId);
      } catch (err) {
        alert(err.message);
      } finally {
        dlBtn.disabled = false;
        dlBtn.textContent = "Download CSV";
      }
    });
  }

  /* ─── Inline export buttons (on Users, Catalog, Audit, Payments pages) ─── */
  document.addEventListener("click", async (event) => {
    const inlineExport = event.target.closest("[data-export-inline]");
    if (inlineExport) {
      const type = inlineExport.dataset.exportInline;
      const urlMap = {
        books: "/api/exports/books",
        members: "/api/exports/members",
        audit: "/api/exports/audit",
        payments: "/api/exports/payments"
      };
      if (!urlMap[type]) return;
      inlineExport.disabled = true;
      inlineExport.textContent = "Exporting…";
      try {
        const payload = await getJson(`${urlMap[type]}?format=csv`, { method: "POST" });
        const filename = payload.filename || `${type}_export.csv`;
        if (payload.content) {
          triggerClientDownload(payload.content, filename, "text/csv");
        } else if (payload.filename) {
          await downloadExportFileDirectly(payload.filename, payload.reportId);
        }
        inlineExport.textContent = "Downloaded";
        setTimeout(() => { inlineExport.textContent = "Export CSV"; inlineExport.disabled = false; }, 3500);
      } catch (err) {
        inlineExport.textContent = `Failed: ${err.message}`;
        setTimeout(() => { inlineExport.textContent = "Export CSV"; inlineExport.disabled = false; }, 3500);
      }
    }
  });

  /* ─── Payments & Subscriptions View ─── */
  async function payments() {
    const table = document.querySelector("[data-payments-table]");
    const searchInput = document.querySelector("[data-payment-search]");
    const statusSelect = document.querySelector("[data-payment-status-filter]");
    const summary = document.querySelector("[data-payment-summary]");
    const revenueEl = document.querySelector("[data-admin-payment-revenue]");
    const countEl = document.querySelector("[data-admin-payment-count]");
    const subscribersEl = document.querySelector("[data-admin-subscribers-count]");

    if (!table) return;

    async function loadData() {
      table.innerHTML = '<div class="state-block"><span class="state-spinner"></span><span>Loading transactions…</span></div>';
      try {
        const payload = await getJson("/api/payments/logs?limit=100");
        let list = payload.data || [];
        const stats = payload.stats || payload.summary || {};

        if (revenueEl) revenueEl.textContent = `₹${Number(stats.totalRevenue || 0).toLocaleString()}`;
        if (countEl) countEl.textContent = String(stats.totalTransactions || list.length);
        if (subscribersEl) subscribersEl.textContent = String(stats.activeSubscribers || 0);

        const q = (searchInput?.value || "").trim().toLowerCase();
        const st = statusSelect?.value || "";

        if (q) {
          list = list.filter(tx => 
            (tx.Username || "").toLowerCase().includes(q) ||
            (tx.FullName || "").toLowerCase().includes(q) ||
            (tx.Email || "").toLowerCase().includes(q) ||
            (tx.PlanName || "").toLowerCase().includes(q) ||
            (tx.RazorpayOrderID || "").toLowerCase().includes(q) ||
            (tx.RazorpayPaymentID || "").toLowerCase().includes(q)
          );
        }
        if (st) {
          list = list.filter(tx => String(tx.PaymentStatus).toUpperCase() === st.toUpperCase());
        }

        if (summary) summary.textContent = `${list.length} transaction${list.length === 1 ? '' : 's'}`;

        if (!list.length) {
          table.innerHTML = '<div class="state-block"><div><strong>No transactions found.</strong><span>Transactions will appear here after members activate subscriptions.</span></div></div>';
          return;
        }

        table.innerHTML = `
          <table class="data-table">
            <thead>
              <tr>
                <th>Date &amp; Time</th>
                <th>Member</th>
                <th>Plan Tier</th>
                <th>Amount</th>
                <th>Order ID &amp; Payment ID</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${list.map(tx => `
                <tr>
                  <td>
                    <div class="table-title">${esc(new Date(tx.CreatedAt).toLocaleDateString())}</div>
                    <div class="table-meta">${esc(new Date(tx.CreatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}</div>
                  </td>
                  <td>
                    <div class="table-title">${esc(tx.FullName || tx.Username || "Member")}</div>
                    <div class="table-meta">${esc(tx.Email || "—")}</div>
                  </td>
                  <td><strong>${esc(tx.PlanName || "Subscription")}</strong></td>
                  <td><strong style="color:var(--color-ink);">₹${Number(tx.Amount).toLocaleString()}</strong></td>
                  <td>
                    <div class="table-title" style="font-family:monospace;font-size:0.75rem;">${esc(tx.RazorpayOrderID || '—')}</div>
                    <div class="table-meta" style="font-family:monospace;font-size:0.75rem;">${esc(tx.RazorpayPaymentID || 'No payment ID')}</div>
                  </td>
                  <td>
                    <span class="payment-status-badge" style="display:inline-block;padding:0.2rem 0.55rem;border-radius:999px;font-size:0.72rem;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;${tx.PaymentStatus === 'SUCCESS' ? 'background:rgba(43,76,68,0.12);color:var(--color-sage-deep);' : tx.PaymentStatus === 'FAILED' ? 'background:rgba(180,40,40,0.12);color:var(--color-danger);' : 'background:rgba(200,150,0,0.12);color:#b37d00;'}">
                      ${esc(tx.PaymentStatus || "PENDING")}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      } catch (err) {
        table.innerHTML = `<div class="state-block"><div><strong>Could not fetch transactions.</strong><span>${esc(err.message)}</span></div></div>`;
      }
    }

    if (searchInput && !searchInput.dataset.bound) {
      searchInput.dataset.bound = "true";
      searchInput.addEventListener("input", loadData);
    }
    if (statusSelect && !statusSelect.dataset.bound) {
      statusSelect.dataset.bound = "true";
      statusSelect.addEventListener("change", loadData);
    }

    loadData();
  }

  /* ─── Profile ─── */
  function profile() { 
    const u = (typeof window !== 'undefined' && window.API) ? window.API.getUser() : null;
    const user = u || { username: "admin.demo", email: "admin.preview@example.test", role: "Admin" }; 
    document.querySelector("[data-admin-profile]").innerHTML = [["Username", user.username], ["Email", user.email], ["Role", user.role]].map(([label, value]) => `<div class="profile-card__row"><span class="profile-card__label">${label}</span><span class="profile-card__value">${value}</span></div>`).join(""); 
  }

  /* ─── Global click handlers ─── */
  document.addEventListener("click", (event) => { const detail = event.target.closest("[data-admin-book-detail]"); if (detail) { const book = demoBooks.find((item) => idOf(item) === detail.dataset.adminBookDetail); if (book) bookDetails(book); } const edit = event.target.closest("[data-admin-book-edit]"); if (edit) { const book = demoBooks.find((item) => idOf(item) === edit.dataset.adminBookEdit); if (book) editBook(book); } const remove = event.target.closest("[data-admin-book-delete]"); if (remove) { if (window.confirm("Delete this book from the catalogue?")) getJson(`/api/books/${encodeURIComponent(remove.dataset.adminBookDelete)}`, { method: "DELETE" }).catch((error) => window.alert(error.message)); } const member = event.target.closest("[data-admin-member-detail]"); if (member) { const record = demoMembers.find((item) => item.MemberID === member.dataset.adminMemberDetail); if (record) modal(`<button class="book-modal__close" type="button" data-admin-close aria-label="Close member details">×</button><p class="eyebrow">Member record</p><h2 class="book-modal__title">${esc(record.FullName)}</h2><dl class="book-modal__metadata"><div><dt>Email</dt><dd>${esc(record.Email)}</dd></div><div><dt>Department</dt><dd>${esc(record.Department)}</dd></div><div><dt>Plan</dt><dd>${esc(record.SubscriptionTier)}</dd></div><div><dt>Status</dt><dd>${record.IsActive ? "Active" : "Inactive"}</dd></div></dl>`); } const deactivate = event.target.closest("[data-admin-member-deactivate]"); if (deactivate && window.confirm("Deactivate this user? This action will call the existing user endpoint.")) getJson(`/api/users/${encodeURIComponent(deactivate.dataset.adminMemberDeactivate)}/deactivate`, { method: "POST" }).catch((error) => window.alert(error.message)); });

  /* ─── View routing ─── */
  function currentView() { const value = window.location.hash.slice(1).toLowerCase(); return validViews.has(value) ? value : "dashboard"; }
  function initializeView(view) { if (view === "dashboard") dashboard(); if (view === "users") users(); if (view === "catalog") catalog(); if (view === "payments") payments(); if (view === "reports") reports(); if (view === "exports") exports(); if (view === "analytics") analytics(); if (view === "audit") audit(); if (view === "profile") profile(); }
  function activateView(view) { const nextView = validViews.has(view) ? view : "dashboard"; document.querySelectorAll("[data-admin-view-panel]").forEach((panel) => { panel.hidden = panel.dataset.adminViewPanel !== nextView; }); document.body.dataset.adminView = nextView; if (!initialized.has(nextView)) { initialized.add(nextView); initializeView(nextView); } }
  window.addEventListener("hashchange", () => activateView(currentView()));
  activateView(currentView());
});
