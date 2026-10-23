"use strict";

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.protectedRole !== "Librarian") return;
  const preview = window.libraryDemo?.role === "Librarian" ? window.libraryDemo : null;
  const validViews = new Set(["dashboard", "catalog", "add-ebook", "members", "payments", "reports", "profile"]);
  const initialized = new Set();
  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]);
  const idOf = (book) => String(book.BookID ?? book.bookId ?? "");
  const titleOf = (book) => book.Title || book.title || "Untitled book";
  const getJson = async (url, options = {}) => {
    const token = (typeof window !== "undefined" && window.API) ? window.API.getToken() : null;
    const headers = { "Content-Type": "application/json", ...options.headers };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const response = await fetch(url, { ...options, headers });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) throw new Error(payload.message || "The library service is unavailable.");
    return payload;
  };
  const state = (container, title, message) => { container.innerHTML = `<div class="state-block"><div><strong>${esc(title)}</strong><span>${esc(message)}</span></div></div>`; };
  const booksFromPreview = () => preview ? preview.books : [];

  /* ─── Animated Counter ─── */
  function animateCounter(element, target) {
    const num = parseInt(target);
    if (isNaN(num)) { element.textContent = target; return; }
    let current = 0;
    const step = Math.max(1, Math.ceil(num / 25));
    const interval = setInterval(() => {
      current += step;
      if (current >= num) { current = num; clearInterval(interval); }
      element.textContent = current.toLocaleString();
    }, 30);
  }

  /* ─── Modals ─── */
  function makeModal() {
    if (document.querySelector("[data-librarian-modal]")) return document.querySelector("[data-librarian-modal]");
    document.body.insertAdjacentHTML("beforeend", `<div class="book-modal" data-librarian-modal hidden><div class="book-modal__backdrop" data-close-modal></div><section class="book-modal__surface member-modal__details" role="dialog" aria-modal="true" aria-labelledby="librarian-modal-title"><button class="book-modal__close" type="button" data-close-modal aria-label="Close book details">×</button><p class="eyebrow" data-modal-category>Book details</p><h2 class="book-modal__title" id="librarian-modal-title" data-modal-title>Book title</h2><p class="book-modal__author" data-modal-author>Author</p><p class="book-modal__description" data-modal-description></p><dl data-modal-metadata></dl></section></div>`);
    const modal = document.querySelector("[data-librarian-modal]"); modal.querySelectorAll("[data-close-modal]").forEach((item) => item.addEventListener("click", () => { modal.hidden = true; })); return modal;
  }
  async function openBook(bookId) {
    try { const payload = preview ? { data: booksFromPreview().find((book) => idOf(book) === String(bookId)) } : await getJson(`/api/books/${encodeURIComponent(bookId)}`); const book = payload.data; if (!book) throw new Error("Book details are unavailable."); const modal = makeModal(); modal.querySelector("[data-modal-category]").textContent = book.GenreName || "Book details"; modal.querySelector("[data-modal-title]").textContent = titleOf(book); modal.querySelector("[data-modal-author]").textContent = book.Author || "Unknown author"; modal.querySelector("[data-modal-description]").textContent = book.Description || "No description is available for this title."; modal.querySelector("[data-modal-metadata]").innerHTML = [["Format", book.Format], ["ISBN", book.ISBN], ["Publisher", book.Publisher], ["Accesses", book.AccessCount]].filter(([, value]) => value != null && value !== "").map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join(""); modal.hidden = false; } catch (error) { window.alert(error.message); }
  }

  /* ─── Table Renderers ─── */
  function bookRows(books, action = "Details") { if (!books.length) return `<div class="state-block"><div><strong>No books found.</strong><span>Try a different search or wait for the catalogue service.</span></div></div>`; return `<table class="data-table"><thead><tr><th>Title</th><th>Author</th><th>Category</th><th>Format</th><th>Accesses</th><th></th></tr></thead><tbody>${books.map((book) => `<tr><td><div class="table-title">${esc(titleOf(book))}</div><div class="table-meta">${esc(book.ISBN || "ISBN unavailable")}</div></td><td>${esc(book.Author || "Unknown")}</td><td>${esc(book.GenreName || "Uncategorized")}</td><td>${esc(book.Format || "Digital")}</td><td>${esc(book.AccessCount ?? "—")}</td><td><button class="table-action" type="button" data-book-open="${esc(idOf(book))}">${action}</button> <button class="table-action" type="button" data-book-edit="${esc(idOf(book))}">Edit</button></td></tr>`).join("")}</tbody></table>`; }
  function memberRows(members) { if (!members.length) return `<div class="state-block"><div><strong>No members found.</strong><span>Member records will appear here when the service is connected.</span></div></div>`; return `<table class="data-table"><thead><tr><th>Member</th><th>Department</th><th>Plan</th><th>Last active</th><th></th></tr></thead><tbody>${members.map((member) => `<tr><td><div class="table-title">${esc(member.FullName || member.Username)}</div><div class="table-meta">${esc(member.Email)}</div></td><td>${esc(member.Department || "—")}</td><td>${esc(member.SubscriptionTier || "—")}</td><td>${esc(member.LastActiveDate || "—")}</td><td><button class="table-action" type="button" data-member-open="${esc(member.MemberID)}">View</button></td></tr>`).join("")}</tbody></table>`; }
  function reportFileRows(list) { if (!list.length) return `<div class="state-block"><div><strong>No generated reports yet.</strong><span>Click an export button above to create your first report.</span></div></div>`; return `<table class="data-table"><thead><tr><th>Report Name</th><th>Type</th><th>Generated By</th><th>Date</th><th>Action</th></tr></thead><tbody>${list.map(r => `<tr><td><div class="table-title">${esc(r.ReportName)}</div></td><td>${esc(r.ReportType || "Analytics")}</td><td>${esc(r.GeneratedByName || "Librarian")}</td><td>${esc(new Date(r.GenerationDate).toLocaleString())}</td><td><button class="table-action button button--quiet" type="button" data-download-report="${esc(r.ReportID)}" data-report-name="${esc(r.ReportName)}">Download CSV</button></td></tr>`).join("")}</tbody></table>`; }

  /* ─── Click delegation ─── */
  document.addEventListener("click", (event) => { const bookButton = event.target.closest("[data-book-open]"); if (bookButton) openBook(bookButton.dataset.bookOpen); const editButton = event.target.closest("[data-book-edit]"); if (editButton) openEdit(editButton.dataset.bookEdit); const memberButton = event.target.closest("[data-member-open]"); if (memberButton) openMember(memberButton.dataset.memberOpen); });
  function openEdit(bookId) { const book = booksFromPreview().find((item) => idOf(item) === String(bookId)); if (!book && preview) return; const existing = document.querySelector("[data-edit-modal]"); if (existing) existing.remove(); const source = book || {}; document.body.insertAdjacentHTML("beforeend", `<div class="book-modal" data-edit-modal><div class="book-modal__backdrop" data-edit-close></div><section class="book-modal__surface member-modal__details" role="dialog" aria-modal="true" aria-labelledby="edit-book-title"><button class="book-modal__close" type="button" data-edit-close aria-label="Close edit book form">×</button><p class="eyebrow">Catalogue metadata</p><h2 class="book-modal__title" id="edit-book-title">Edit e-book</h2><form data-edit-form><label class="field"><span>Title</span><input name="title" value="${esc(source.Title)}" required></label><label class="field"><span>Author</span><input name="author" value="${esc(source.Author)}" required></label><label class="field"><span>Publisher</span><input name="publisher" value="${esc(source.Publisher)}"></label><label class="field"><span>Category ID</span><input name="categoryId" value="${esc(source.CategoryID)}"></label><label class="field"><span>Description</span><textarea name="description" rows="4">${esc(source.Description)}</textarea></label><div class="form-actions"><button class="button button--primary" type="submit">Save changes</button><span class="form-feedback" data-edit-feedback role="status"></span></div></form></section></div>`); const modal = document.querySelector("[data-edit-modal]"); modal.querySelectorAll("[data-edit-close]").forEach((item) => item.addEventListener("click", () => modal.remove())); modal.querySelector("[data-edit-form]").addEventListener("submit", async (event) => { event.preventDefault(); const feedback = modal.querySelector("[data-edit-feedback]"); if (preview) { feedback.textContent = "Preview mode: no request was sent."; return; } feedback.textContent = "Saving…"; try { const data = Object.fromEntries(new FormData(event.currentTarget).entries()); const payload = await getJson(`/api/books/${encodeURIComponent(bookId)}`, { method: "PUT", body: JSON.stringify(data) }); feedback.className = "form-feedback is-success"; feedback.textContent = payload.message || "Book updated successfully."; } catch (error) { feedback.className = "form-feedback is-error"; feedback.textContent = error.message; } }); }

  async function loadCategories(select) { try { const payload = preview ? { data: preview.categories } : await getJson("/api/categories"); (payload.data || []).forEach((category) => { const option = document.createElement("option"); option.value = category.CategoryID ?? category.categoryId; option.textContent = category.GenreName || category.name; select.append(option); }); } catch { select.innerHTML = '<option value="">Categories unavailable</option>'; } }
  async function fetchBooks({ page = 1, search = "", category = "", limit = 8 } = {}) { if (preview) { let books = booksFromPreview(); if (search) { const query = search.toLowerCase(); books = books.filter((book) => `${titleOf(book)} ${book.Author} ${book.ISBN}`.toLowerCase().includes(query)); } if (category) books = books.filter((book) => String(book.CategoryID) === String(category)); return { data: books, pagination: { page: 1, pages: 1, total: books.length, limit } }; } return getJson(`/api/books?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}`); }

  /* ═══════ DASHBOARD ═══════ */
  async function dashboard() {
    const booksTarget = document.querySelector("[data-dashboard-books]"),
          membersTarget = document.querySelector("[data-dashboard-members]");

    // Load stats
    try {
      const booksPayload = await fetchBooks({ limit: 5 });
      const books = booksPayload.data || [];
      animateCounter(document.querySelector("[data-stat-books]"), preview ? books.length : (booksPayload.pagination?.total ?? books.length));
      booksTarget.innerHTML = bookRows(books, "Details");
    } catch {
      document.querySelector("[data-stat-books]").textContent = "—";
      state(booksTarget, "Catalogue unavailable.", "The backend could not return book records.");
    }
    try {
      const payload = preview ? { data: preview.members } : await getJson("/api/members");
      const members = payload.data || [];
      animateCounter(document.querySelector("[data-stat-members]"), members.length);
      membersTarget.innerHTML = memberRows(members.slice(0, 5));
    } catch {
      document.querySelector("[data-stat-members]").textContent = "—";
      state(membersTarget, "Member records unavailable.", "The backend could not return member records.");
    }

    // Category mini-chart
    const catChart = document.querySelector("[data-lib-category-chart]");
    if (catChart) {
      try {
        const catPayload = preview ? { data: preview.categories } : await getJson("/api/categories");
        const cats = (catPayload.data || []).filter(c => (c.BookCount || 0) > 0).slice(0, 6);
        if (cats.length) {
          catChart.innerHTML = cats.map(c => {
            const width = Math.min(100, (c.BookCount || 1) * 20);
            return `<div class="bar-row"><span>${esc(c.GenreName)}</span><span class="bar-track"><span class="bar-fill" style="width:${width}%"></span></span><strong>${c.BookCount || 0}</strong></div>`;
          }).join("");
        } else {
          catChart.innerHTML = '<div class="state-block"><span>No category data available.</span></div>';
        }
      } catch {
        catChart.innerHTML = '<div class="state-block"><span>Could not load categories.</span></div>';
      }
    }
  }

  /* ═══════ CATALOG ═══════ */
  async function catalog() { const table = document.querySelector("[data-catalog-table]"), search = document.querySelector("[data-catalog-search]"), category = document.querySelector("[data-catalog-category]"), summary = document.querySelector("[data-catalog-summary]"), pagination = document.querySelector("[data-catalog-pagination]"); await loadCategories(category); let page = 1; const render = async () => { table.innerHTML = '<div class="state-block"><span class="state-spinner"></span><span>Loading catalogue…</span></div>'; try { const payload = await fetchBooks({ page, search: search.value.trim(), category: category.value }); const books = payload.data || []; summary.textContent = `${payload.pagination?.total ?? books.length} titles`; table.innerHTML = bookRows(books); const pages = Math.min(payload.pagination?.pages || 1, 8); pagination.innerHTML = pages > 1 ? Array.from({ length: pages }, (_, index) => `<button type="button" data-catalog-page="${index + 1}" aria-current="${index + 1 === page ? "page" : "false"}">${index + 1}</button>`).join("") : ""; } catch { summary.textContent = ""; state(table, "Catalogue unavailable.", "The library service could not be reached. Preview mode is available for visual review."); pagination.innerHTML = ""; } }; let timer; [search, category].forEach((control) => control.addEventListener("input", () => { page = 1; clearTimeout(timer); timer = setTimeout(render, 180); })); document.querySelector("[data-catalog-reset]").addEventListener("click", () => { search.value = ""; category.value = ""; page = 1; render(); }); pagination.addEventListener("click", (event) => { const button = event.target.closest("[data-catalog-page]"); if (button) { page = Number(button.dataset.catalogPage); render(); } }); render(); }

  /* ═══════ MEMBERS ═══════ */
  async function openMember(memberId) { try { const payload = preview ? { data: preview.members.find((member) => String(member.MemberID) === String(memberId)) } : await getJson(`/api/members/${encodeURIComponent(memberId)}`); const member = payload.data; if (!member) throw new Error("Member details are unavailable."); const modal = makeMemberModal(); modal.querySelector("[data-member-modal-title]").textContent = member.FullName || member.Username; modal.querySelector("[data-member-modal-body]").innerHTML = [["Username", member.Username], ["Email", member.Email], ["Department", member.Department], ["Subscription", member.SubscriptionTier], ["Registered", member.RegistrationDate], ["Status", member.IsActive === 0 ? "Inactive" : "Active"]].filter(([, value]) => value != null && value !== "").map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join(""); modal.hidden = false; } catch (error) { window.alert(error.message); } }
  function makeMemberModal() { if (document.querySelector("[data-member-detail-modal]")) return document.querySelector("[data-member-detail-modal]"); document.body.insertAdjacentHTML("beforeend", `<div class="book-modal" data-member-detail-modal hidden><div class="book-modal__backdrop" data-close-member></div><section class="book-modal__surface member-modal__details" role="dialog" aria-modal="true" aria-labelledby="member-detail-title"><button class="book-modal__close" type="button" data-close-member aria-label="Close member details">×</button><p class="eyebrow">Member record</p><h2 class="book-modal__title" id="member-detail-title" data-member-modal-title>Member</h2><dl data-member-modal-body></dl></section></div>`); const modal = document.querySelector("[data-member-detail-modal]"); modal.querySelectorAll("[data-close-member]").forEach((item) => item.addEventListener("click", () => { modal.hidden = true; })); return modal; }
  async function members() { const table = document.querySelector("[data-member-table]"), search = document.querySelector("[data-member-search]"), summary = document.querySelector("[data-member-summary]"); try { const payload = preview ? { data: preview.members } : await getJson("/api/members"); const all = payload.data || []; const render = () => { const query = search.value.trim().toLowerCase(); const filtered = all.filter((member) => `${member.FullName} ${member.Username} ${member.Email}`.toLowerCase().includes(query)); summary.textContent = `${filtered.length} member${filtered.length === 1 ? "" : "s"}`; table.innerHTML = memberRows(filtered); }; search.addEventListener("input", render); render(); } catch { summary.textContent = ""; state(table, "Member records unavailable.", "The backend could not return member records. No placeholder accounts were created."); } }
  async function addBook() { const form = document.querySelector("[data-book-form]"), category = document.querySelector("[data-form-category]"), feedback = document.querySelector("[data-form-feedback]"); await loadCategories(category); form.addEventListener("submit", async (event) => { event.preventDefault(); if (!form.reportValidity()) return; const data = Object.fromEntries(new FormData(form).entries()); data.fileSize = Number(data.fileSize); feedback.className = "form-feedback"; feedback.textContent = preview ? "Preview mode: no request was sent." : "Saving…"; if (preview) return; try { const payload = await getJson("/api/books", { method: "POST", body: JSON.stringify(data) }); feedback.className = "form-feedback is-success"; feedback.textContent = payload.message || "Book uploaded successfully."; form.reset(); } catch (error) { feedback.className = "form-feedback is-error"; feedback.textContent = error.message; } }); }

  /* ═══════ REPORTS & EXPORTS ═══════ */
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

  async function paymentsPanel() {
    const table = document.querySelector("[data-lib-payments-table]");
    const searchInput = document.querySelector("[data-lib-payment-search]");
    const statusSelect = document.querySelector("[data-lib-payment-status]");
    const summary = document.querySelector("[data-lib-payment-summary]");
    if (!table) return;

    async function loadData() {
      table.innerHTML = '<div class="state-block"><span class="state-spinner"></span><span>Loading transactions…</span></div>';
      try {
        const payload = await getJson("/api/payments/logs?limit=50");
        let list = payload.data || [];
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
                <th>Plan</th>
                <th>Amount</th>
                <th>Payment ID</th>
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
                  <td><strong>₹${Number(tx.Amount).toLocaleString()}</strong></td>
                  <td>
                    <div class="table-meta" style="font-family:monospace;font-size:0.75rem;">${esc(tx.RazorpayPaymentID || tx.RazorpayOrderID || '—')}</div>
                  </td>
                  <td>
                    <span class="payment-status-badge ${tx.PaymentStatus === 'SUCCESS' ? 'is-success' : tx.PaymentStatus === 'FAILED' ? 'is-failed' : 'is-pending'}" style="display:inline-block;padding:0.2rem 0.55rem;border-radius:999px;font-size:0.72rem;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;${tx.PaymentStatus === 'SUCCESS' ? 'background:rgba(43,76,68,0.12);color:var(--color-sage-deep);' : tx.PaymentStatus === 'FAILED' ? 'background:rgba(180,40,40,0.12);color:var(--color-danger);' : 'background:rgba(200,150,0,0.12);color:#b37d00;'}">
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

  async function reportsPanel() {
    const exportActions = {
      "books": "/api/exports/books",
      "members": "/api/exports/members",
      "reading": "/api/exports/reading",
      "access-logs": "/api/exports/access-logs",
      "payments": "/api/exports/payments"
    };

    // Bind export buttons
    document.querySelectorAll("[data-lib-report-action]").forEach(btn => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = "true";
      btn.addEventListener("click", async () => {
        const type = btn.dataset.libReportAction;
        const urlBase = exportActions[type];
        if (!urlBase) return;

        const formatRadio = document.querySelector('input[name="libExportFormat"]:checked');
        const format = formatRadio ? formatRadio.value : "csv";

        const params = new URLSearchParams({ format });
        const statusEl = document.querySelector(`[data-lib-report-status="${type}"]`);
        btn.disabled = true;
        const origText = btn.textContent;
        btn.textContent = "Exporting…";
        if (statusEl) {
          statusEl.className = "lib-export-card__status is-loading";
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
            statusEl.className = "lib-export-card__status is-success";
            const countText = payload.recordsCount != null ? ` (${payload.recordsCount} records)` : "";
            statusEl.textContent = `Downloaded ${filename}${countText}`;
          }

          loadReportsHistory();
        } catch (err) {
          if (statusEl) {
            statusEl.className = "lib-export-card__status is-error";
            statusEl.textContent = `Failed: ${err.message}`;
          }
        } finally {
          btn.disabled = false;
          btn.textContent = origText;
        }
      });
    });

    // Refresh button
    const refreshBtn = document.querySelector("[data-lib-refresh-reports]");
    if (refreshBtn && !refreshBtn.dataset.bound) {
      refreshBtn.dataset.bound = "true";
      refreshBtn.addEventListener("click", loadReportsHistory);
    }

    loadReportsHistory();
  }

  async function loadReportsHistory() {
    const table = document.querySelector("[data-lib-reports-table]");
    if (!table) return;
    table.innerHTML = '<div class="state-block"><span class="state-spinner"></span><span>Loading export history…</span></div>';
    try {
      const payload = await getJson("/api/reports");
      const list = payload.data || [];
      table.innerHTML = reportFileRows(list);
      bindDownloadButtons(table);
    } catch (err) {
      table.innerHTML = `<div class="state-block"><div><strong>Could not fetch reports.</strong><span>${esc(err.message)}</span></div></div>`;
    }
  }

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

  /* ─── Inline export buttons (on Catalog, Members, Payments pages) ─── */
  document.addEventListener("click", async (event) => {
    const inlineExport = event.target.closest("[data-lib-export]");
    if (inlineExport) {
      const type = inlineExport.dataset.libExport;
      const urlMap = {
        books: "/api/exports/books",
        members: "/api/exports/members",
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

  /* ─── Profile ─── */
  function profile() { 
    const u = (typeof window !== 'undefined' && window.API) ? window.API.getUser() : null;
    const user = u || preview?.user || { username: "librarian", email: "Not available", role: "Librarian" }; 
    document.querySelector("[data-librarian-profile]").innerHTML = [["Username", user.username], ["Email", user.email], ["Role", user.role]].map(([label, value]) => `<div class="profile-card__row"><span class="profile-card__label">${esc(label)}</span><span class="profile-card__value">${esc(value || "Unavailable")}</span></div>`).join(""); 
  }

  /* ─── View routing ─── */
  function currentView() { const value = window.location.hash.slice(1).toLowerCase(); return validViews.has(value) ? value : "dashboard"; }
  function initializeView(view) { if (view === "dashboard") dashboard(); if (view === "catalog") catalog(); if (view === "members") members(); if (view === "add-ebook") addBook(); if (view === "payments") paymentsPanel(); if (view === "reports") reportsPanel(); if (view === "profile") profile(); }
  function activateView(view) { const nextView = validViews.has(view) ? view : "dashboard"; document.querySelectorAll("[data-librarian-view-panel]").forEach((panel) => { panel.hidden = panel.dataset.librarianViewPanel !== nextView; }); document.body.dataset.librarianView = nextView; if (!initialized.has(nextView)) { initialized.add(nextView); initializeView(nextView); } }
  window.addEventListener("hashchange", () => activateView(currentView()));
  activateView(currentView());
});
