"use strict";

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.protectedRole !== "Member") return;

  const cacheKey = "digitalLibraryBookCache";
  const recentKey = "digitalLibraryRecentBooks";
  const bookmarksKey = "digitalLibraryBookmarks";
  const preview = window.libraryDemo?.role === "Member" ? window.libraryDemo : null;
  const validViews = new Set(["dashboard", "library", "collections", "history", "bookmarks", "profile"]);
  const initialized = new Set();
  let bookmarks;
  let activeBookId = null;
  let lastTrigger = null;

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  const bookId = (book) => String(book.BookID ?? book.bookId ?? "");
  const titleOf = (book) => book.Title || book.title || "Untitled book";
  const authorOf = (book) => book.Author || book.author || "Unknown author";
  const categoryOf = (book) => book.GenreName || book.category || "General";
  const formatOf = (book) => book.Format || book.format || "Digital";
  const initials = (title = "Book") => title.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
  const coverTone = (book) => { const tones = ["sage", "lavender", "charcoal", "ivory"]; const seed = String(book.BookID || book.bookId || book.Title || "book").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0); return tones[seed % tones.length]; };
  const readCache = () => { if (preview) return Object.fromEntries(preview.books.map((book) => [bookId(book), book])); try { return JSON.parse(localStorage.getItem(cacheKey) || "{}"); } catch { return {}; } };
  const cacheBooks = (books) => { if (preview) return; const cache = readCache(); books.forEach((book) => { if (bookId(book)) cache[bookId(book)] = book; }); localStorage.setItem(cacheKey, JSON.stringify(cache)); };
  const getJson = async (url) => { const response = await fetch(url); const payload = await response.json().catch(() => ({})); if (!response.ok || payload.success === false) throw new Error(payload.message || "The library service is unavailable."); return payload; };
  bookmarks = new Map();
  let recentBooks = [];
  const loadUserData = async () => {
    if (!API.isAuthenticated()) {
      try {
        const local = JSON.parse(localStorage.getItem(bookmarksKey) || "[]").map(String);
        bookmarks = new Map(local.map(id => [id, null]));
      } catch(e) {}
      try {
        recentBooks = JSON.parse(localStorage.getItem(recentKey) || "[]");
      } catch(e) {}
      refreshLocalSections();
      return;
    }
    try {
      const bRes = await API.getAllBookmarks();
      if (bRes && bRes.data) {
        bookmarks = new Map(bRes.data.map(b => [String(b.BookID), String(b.BookmarkID)]));
        cacheBooks(bRes.data);
      }
      const pRes = await API.getAllProgress();
      if (pRes && pRes.data) {
        const books = pRes.data.map(p => ({
          BookID: p.BookID, Title: p.Title, Author: p.Author, GenreName: p.GenreName, CoverImagePath: p.CoverImagePath
        }));
        cacheBooks(books);
        recentBooks = pRes.data.map(p => ({
          book: books.find(b => b.BookID === p.BookID),
          openedAt: p.LastAccessed
        }));
      }
    } catch(e) { console.error(e); }
    refreshLocalSections();
    if (typeof currentView !== 'undefined' && currentView() === "history") renderHistory();
  };
  loadUserData();

  function currentView() { const value = window.location.hash.slice(1).toLowerCase(); return validViews.has(value) ? value : "dashboard"; }
  function activateView(view) {
    const nextView = validViews.has(view) ? view : "dashboard";
    document.querySelectorAll("[data-member-view-panel]").forEach((panel) => { panel.hidden = panel.dataset.memberViewPanel !== nextView; });
    document.body.dataset.memberView = nextView;
    if (!initialized.has(nextView)) { initialized.add(nextView); initializeView(nextView); }
    refreshLocalSections();
    if (nextView === "history") renderHistory();
    if (nextView === "profile") renderProfile();
  }

  function renderGrid(container, books, isRecommended = false) {
    if (!books.length) { container.innerHTML = '<div class="member-empty">Nothing to show here yet.</div>'; return; }
    container.innerHTML = books.map((book) => {
      const id = bookId(book);
      const title = titleOf(book);
      const saved = bookmarks.has(id);
      const matchPct = book.matchPercentage ? `${book.matchPercentage}% Match` : '';
      const matchBadge = matchPct ? `<span class="match-chip ${book.matchPercentage >= 85 ? 'match-chip--high' : ''}">${escapeHtml(matchPct)}</span>` : '';
      const reasonHtml = book.reason ? `<span class="recommendation-reason" title="${escapeHtml(book.reason)}">${escapeHtml(book.reason)}</span>` : '';
      const isExclusive = Boolean(book.IsExclusive);
      const exclusiveBadge = isExclusive ? `<span class="exclusive-pill" style="position:absolute;top:10px;left:10px;z-index:3;">Exclusive</span>` : '';

      return `<article class="book-card"><button class="book-card__open" type="button" data-book-id="${escapeHtml(id)}" aria-label="View details for ${escapeHtml(title)}"><span class="book-cover book-cover--${coverTone(book)}" aria-hidden="true">${exclusiveBadge}${matchBadge}${book.CoverImagePath ? `<img src="${escapeHtml(book.CoverImagePath)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit;z-index:1;" />` : `<span class="book-cover__initials">${escapeHtml(initials(title))}</span><span class="book-cover__format">${escapeHtml(formatOf(book))}</span>`}</span><span class="book-card__meta"><span class="book-card__category">${escapeHtml(categoryOf(book))}</span><span class="book-card__title">${escapeHtml(title)}</span><span class="book-card__author">${escapeHtml(authorOf(book))}</span>${reasonHtml}</span></button><button class="book-card__bookmark ${saved ? "is-saved" : ""}" type="button" data-bookmark-id="${escapeHtml(id)}" aria-label="${saved ? "Remove" : "Save"} ${escapeHtml(title)} bookmark" aria-pressed="${saved}"><svg aria-hidden="true" viewBox="0 0 24 24" fill="${saved ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.7"><path d="M6.5 4.75A2.25 2.25 0 0 1 8.75 2.5h6.5a2.25 2.25 0 0 1 2.25 2.25v16.5l-5.75-3.5L6 21.25V4.75Z"></path></svg></button></article>`;
    }).join("");
  }

  function refreshLocalSections() {
    const cache = readCache();
    const saved = Array.from(bookmarks.keys()).map((id) => cache[id]).filter(Boolean);
    const recent = recentBooks.map((entry) => entry.book).filter(Boolean);
    document.querySelectorAll('[data-books-source="saved"]').forEach((container) => renderGrid(container, saved));
    document.querySelectorAll('[data-books-source="recent"]').forEach((container) => renderGrid(container, recent));
  }

  function showState(container, title, message) { container.innerHTML = `<div class="member-state"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span></div>`; }

  async function loadRecommendations() {
    const container = document.querySelector('[data-books-source="recommendations"]');
    const signalBadge = document.querySelector('[data-recommendation-signal]');
    if (!container) return;

    container.innerHTML = '<div class="catalogue-state catalogue-state--loading"><span class="state-spinner"></span><span>Computing personalized recommendations…</span></div>';

    try {
      let clientSearches = [];
      try {
        clientSearches = JSON.parse(localStorage.getItem('digitalLibrarySearchHistory') || '[]');
      } catch(e) {}

      const payload = await API.getRecommendations({
        limit: 4,
        searches: clientSearches.map(s => s.query).filter(Boolean)
      });

      const books = Array.isArray(payload?.data) ? payload.data : [];
      if (!books.length) {
        showState(container, 'No suggestions right now.', 'Read or search for a few titles to unlock AI suggestions.');
        return;
      }

      cacheBooks(books);
      renderGrid(container, books, true);

      if (signalBadge && payload.signalsUsed) {
        const reads = payload.signalsUsed.recentReadsCount || 0;
        const searches = payload.signalsUsed.searchesCount || clientSearches.length;
        if (reads > 0 && searches > 0) {
          signalBadge.textContent = `Trained on ${reads} recent ${reads === 1 ? 'read' : 'reads'} & ${searches} ${searches === 1 ? 'search' : 'searches'}`;
        } else if (reads > 0) {
          signalBadge.textContent = `Trained on ${reads} recent ${reads === 1 ? 'read' : 'reads'}`;
        } else if (searches > 0) {
          signalBadge.textContent = `Trained on ${searches} recent ${searches === 1 ? 'search' : 'searches'}`;
        } else {
          signalBadge.textContent = 'Based on curated reading taste';
        }
      }
    } catch (error) {
      console.warn('Recommendation load error:', error);
      showState(container, 'Recommendations resting.', 'Our AI engine is updating. Please check back shortly.');
    }
  }

  async function loadDiscoverBooks() {
    const container = document.querySelector('[data-books-source="discover"]');
    if (!container) return;
    if (preview) { cacheBooks(preview.books); renderGrid(container, preview.books); return; }
    try { const payload = await getJson("/api/books?page=1&limit=4"); const books = Array.isArray(payload.data) ? payload.data : []; cacheBooks(books); renderGrid(container, books); } catch { showState(container, "Discovery is resting.", "The catalogue is unavailable right now. You can still browse your saved and recently opened books."); }
  }

  async function loadCollections() {
    const list = document.querySelector("[data-member-categories]");
    const grid = document.querySelector('[data-books-source="collection"]');
    if (!list || !grid) return;
    try {
      const payload = preview ? { data: preview.categories } : await getJson("/api/categories");
      const categories = Array.isArray(payload.data) ? payload.data : [];
      if (!categories.length) { list.innerHTML = '<span class="state-copy">No subjects are available yet.</span>'; showState(grid, "No collection to open.", "Subjects will appear here when the catalogue is connected."); return; }
      list.innerHTML = categories.map((category, index) => { const id = String(category.CategoryID ?? category.categoryId ?? ""); const name = category.GenreName || category.name || "Untitled subject"; const count = category.BookCount ?? category.bookCount; return `<button class="collection-choice ${index === 0 ? "is-active" : ""}" type="button" data-collection-id="${escapeHtml(id)}"><span class="collection-choice__name">${escapeHtml(name)}</span><span class="collection-choice__meta">${count == null ? "Explore subject" : `${count} books`}</span></button>`; }).join("");
      await loadCollectionBooks(String(categories[0].CategoryID ?? categories[0].categoryId ?? ""));
    } catch { list.innerHTML = '<span class="state-copy">Subjects are unavailable right now.</span>'; showState(grid, "Collections are unavailable.", "The catalogue service could not be reached."); }
  }

  async function loadCollectionBooks(categoryId = "") {
    const grid = document.querySelector('[data-books-source="collection"]');
    const summary = document.querySelector("[data-collection-summary]");
    if (!grid) return;
    grid.innerHTML = '<div class="catalogue-state catalogue-state--loading"><span class="state-spinner"></span><span>Opening the collection…</span></div>';
    try { const books = preview ? preview.books.filter((book) => !categoryId || categoryOf(book) === categoryId) : await (async () => { const params = new URLSearchParams({ page: "1", limit: "12" }); if (categoryId) params.set("category", categoryId); const payload = await getJson(`/api/books?${params}`); return Array.isArray(payload.data) ? payload.data : []; })(); cacheBooks(books); if (summary) summary.textContent = `${books.length} ${books.length === 1 ? "book" : "books"}`; renderGrid(grid, books); } catch { showState(grid, "This collection is unavailable.", "The catalogue service could not be reached right now."); if (summary) summary.textContent = ""; }
  }

  function renderHistory() {
    const list = document.querySelector("[data-history-list]");
    if (!list) return;
    const recent = recentBooks;
    if (!recent.length) { list.innerHTML = '<div class="member-empty">No reading activity recorded yet.</div>'; return; }
    list.innerHTML = recent.map((entry) => `<div class="activity-item"><time class="activity-item__date" datetime="${escapeHtml(entry.openedAt)}">${new Date(entry.openedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</time><div><div class="activity-item__title">${escapeHtml(titleOf(entry.book))}</div><div class="activity-item__author">${escapeHtml(authorOf(entry.book))}</div></div><button class="activity-item__open" type="button" data-book-id="${escapeHtml(bookId(entry.book))}">Open details</button></div>`).join("");
  }

  async function renderProfile() {
    const container = document.querySelector("[data-profile-content]");
    if (!container) return;
    const user = typeof API !== 'undefined' && API.getUser ? API.getUser() : null;
    if (!user) {
       container.innerHTML = `<div class="profile-loading">Please log in to view profile.</div>`;
       return;
    }

    let subHtml = '<div class="profile-card__row"><span class="profile-card__label">Subscription</span><span class="profile-card__value">Standard (Free)</span></div>';
    let txHtml = '';

    if (API.getUserSubscription) {
      try {
        const subRes = await API.getUserSubscription();
        if (subRes && subRes.success) {
          const isPremium = subRes.tier === 'Premium';
          const tierBadge = isPremium 
            ? `<span class="exclusive-pill" style="margin-left:0.5rem;">Premium Member</span>` 
            : `<span style="display:inline-block;padding:0.2rem 0.5rem;background:rgba(0,0,0,0.06);border-radius:999px;font-size:0.75rem;font-weight:700;margin-left:0.5rem;">Free Tier</span>`;

          const upgradeBtn = !isPremium
            ? `<button class="button button--accent button--small" type="button" data-upgrade-btn style="margin-top:0.5rem;">Upgrade to Premium (Razorpay)</button>`
            : '';

          subHtml = `
            <div class="profile-card__row">
              <span class="profile-card__label">Subscription Tier</span>
              <div class="profile-card__value">
                ${tierBadge}
                ${upgradeBtn}
              </div>
            </div>
            ${isPremium && subRes.subscription?.plan ? `
              <div class="profile-card__row">
                <span class="profile-card__label">Active Plan</span>
                <span class="profile-card__value">${escapeHtml(subRes.subscription.plan)} (Expires: ${subRes.subscription.endDate ? new Date(subRes.subscription.endDate).toLocaleDateString() : 'Active'})</span>
              </div>
            ` : ''}
          `;

          if (Array.isArray(subRes.recentTransactions) && subRes.recentTransactions.length > 0) {
            txHtml = `
              <div style="margin-top:1.5rem;border-top:1px solid var(--color-line);padding-top:1rem;">
                <p style="font-size:var(--text-xs);font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:var(--color-ink-soft);margin-bottom:0.5rem;">Recent Payment Transactions</p>
                <div style="font-size:0.85rem;display:flex;flex-direction:column;gap:0.4rem;">
                  ${subRes.recentTransactions.map(tx => `
                    <div style="display:flex;justify-content:space-between;padding:0.4rem 0.6rem;background:rgba(0,0,0,0.02);border-radius:var(--radius-sm);border:1px solid var(--color-line);">
                      <div><strong>${escapeHtml(tx.PlanName)}</strong> &bull; <span style="color:var(--color-ink-soft);">${escapeHtml(tx.RazorpayPaymentID || tx.RazorpayOrderID || 'TXN')}</span></div>
                      <div><strong>₹${Number(tx.Amount).toLocaleString()}</strong> &bull; <span style="color:var(--color-sage-deep);font-weight:700;">${escapeHtml(tx.PaymentStatus)}</span></div>
                    </div>
                  `).join('')}
                </div>
              </div>
            `;
          }
        }
      } catch (e) {
        console.warn("Could not fetch subscription details:", e);
      }
    }

    container.innerHTML = `
      <div class="profile-card__row"><span class="profile-card__label">Username</span><span class="profile-card__value">${escapeHtml(user.username || "Not available")}</span></div>
      <div class="profile-card__row"><span class="profile-card__label">Email</span><span class="profile-card__value">${escapeHtml(user.email || "Not available")}</span></div>
      <div class="profile-card__row"><span class="profile-card__label">Role</span><span class="profile-card__value">${escapeHtml(user.role || "Member")}</span></div>
      ${subHtml}
      ${txHtml}
    `;

    const upBtn = container.querySelector("[data-upgrade-btn]");
    if (upBtn) {
      upBtn.addEventListener("click", () => {
        if (window.SubscriptionModal) {
          window.SubscriptionModal.open({
            onSuccess: () => renderProfile()
          });
        }
      });
    }
  }

  function ensureModal() {
    if (document.querySelector("[data-member-modal]")) return document.querySelector("[data-member-modal]");
    document.body.insertAdjacentHTML("beforeend", `<div class="book-modal" data-member-modal hidden><div class="book-modal__backdrop" data-modal-close></div><section class="book-modal__surface" role="dialog" aria-modal="true" aria-labelledby="member-modal-title" aria-describedby="member-modal-description"><button class="book-modal__close" type="button" data-modal-close aria-label="Close book details">×</button><div class="book-modal__grid"><div class="book-cover book-cover--modal" data-modal-cover aria-hidden="true"></div><div class="book-modal__content"><p class="eyebrow" data-modal-category>Book details</p><h2 class="book-modal__title" id="member-modal-title" data-modal-title>Book title</h2><p class="book-modal__author" data-modal-author>Author</p><p class="book-modal__description" id="member-modal-description" data-modal-description>Loading book details…</p><dl class="book-modal__metadata" data-modal-metadata></dl><div class="book-modal__actions"></div></div></div></section></div>`);
    const modal = document.querySelector("[data-member-modal]");
    modal.querySelectorAll("[data-modal-close]").forEach((button) => button.addEventListener("click", closeModal));
    return modal;
  }

  async function openBook(id, trigger) {
    const modal = ensureModal(); activeBookId = id; lastTrigger = trigger; modal.hidden = false; document.body.classList.add("modal-open");
    const title = modal.querySelector("[data-modal-title]"), author = modal.querySelector("[data-modal-author]"), category = modal.querySelector("[data-modal-category]"), description = modal.querySelector("[data-modal-description]"), cover = modal.querySelector("[data-modal-cover]"), metadata = modal.querySelector("[data-modal-metadata]"), actions = modal.querySelector(".book-modal__actions");
    title.textContent = "Loading details…"; author.textContent = ""; description.textContent = "Fetching book information…"; metadata.replaceChildren(); modal.querySelector(".book-modal__close").focus();
    try {
      const payload = preview ? { data: preview.books.find((book) => bookId(book) === id) } : await getJson(`/api/books/${encodeURIComponent(id)}`);
      const book = payload.data || {};
      if (!book.BookID && !book.bookId) throw new Error("Book details are unavailable right now.");
      cacheBooks([book]);
      recordRecent(book);
      title.textContent = titleOf(book);
      author.textContent = authorOf(book);
      category.textContent = categoryOf(book);
      description.textContent = book.Description || book.description || "Book details are available in the catalogue record.";
      cover.className = `book-cover book-cover--modal book-cover--${coverTone(book)}`;
      cover.innerHTML = book.CoverImagePath ? `<img src="${escapeHtml(book.CoverImagePath)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit;z-index:1;" />` : `<span class="book-cover__initials">${escapeHtml(initials(titleOf(book)))}</span><span class="book-cover__format">${escapeHtml(formatOf(book))}</span>`;
      const fields = [["Format", formatOf(book)], ["ISBN", book.ISBN], ["Pages", book.TotalPages], ["File size", book.FileSizeMB ? `${book.FileSizeMB} MB` : null]].filter(([, value]) => value != null && value !== "");
      metadata.innerHTML = fields.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value))}</dd></div>`).join("");

      const isExclusiveBook = Boolean(book.IsExclusive);
      const user = API.getUser() || {};
      const userTier = user.subscriptionTier || "Free";
      const userRole = user.role || "Member";
      const isLocked = isExclusiveBook && userRole === "Member" && userTier !== "Premium";

      actions.innerHTML = `
        <button class="button ${isLocked ? 'button--accent' : 'button--quiet'}" type="button" data-modal-read>${isLocked ? 'Unlock Exclusive' : 'Open reader'}</button>
        <button class="button button--primary" type="button" data-modal-bookmark>Save bookmark</button>
      `;

      const readBtn = actions.querySelector("[data-modal-read]");
      readBtn.addEventListener("click", () => {
        if (isLocked) {
          if (window.SubscriptionModal) {
            window.SubscriptionModal.open({
              bookTitle: titleOf(book),
              bookId: id,
              onSuccess: () => {
                window.location.href = `reader.html?id=${encodeURIComponent(id)}`;
              }
            });
          }
        } else {
          window.location.href = `reader.html?id=${encodeURIComponent(id)}`;
        }
      });

      actions.querySelector("[data-modal-bookmark]").addEventListener("click", toggleModalBookmark);
      updateModalBookmark();
      refreshLocalSections();
      renderHistory();
    } catch (error) {
      description.textContent = error.message || "Book details are unavailable right now.";
      category.textContent = "Book details";
    }
  }

  async function recordRecent(book) { 
    const entries = recentBooks.filter((entry) => bookId(entry.book) !== bookId(book)); 
    entries.unshift({ book, openedAt: new Date().toISOString() }); 
    recentBooks = entries.slice(0, 20);
    if (API.isAuthenticated()) {
      await API.updateProgress(bookId(book), 0, 0);
    } else {
      localStorage.setItem(recentKey, JSON.stringify(recentBooks)); 
    }
  }
  function updateModalBookmark() { const modal = document.querySelector("[data-member-modal]"); if (!modal) return; const button = modal.querySelector("[data-modal-bookmark]"); const saved = bookmarks.has(String(activeBookId)); button.textContent = saved ? "Remove bookmark" : "Save bookmark"; button.setAttribute("aria-pressed", String(saved)); }
  async function toggleModalBookmark() { 
    const id = String(activeBookId); 
    const button = document.querySelector("[data-modal-bookmark]");
    if (button) button.disabled = true;
    try {
      if (bookmarks.has(id)) { 
        if (API.isAuthenticated()) {
          const bookmarkId = bookmarks.get(id);
          if (bookmarkId) await API.deleteBookmark(bookmarkId);
        }
        bookmarks.delete(id); 
      } else { 
        if (API.isAuthenticated()) {
          const res = await API.createBookmark(id);
          bookmarks.set(id, res.bookmarkId);
        } else {
          bookmarks.set(id, null);
        }
      } 
      if (!API.isAuthenticated()) {
         localStorage.setItem(bookmarksKey, JSON.stringify(Array.from(bookmarks.keys())));
      }
      updateModalBookmark(); 
      refreshLocalSections(); 
    } catch(e) { console.error(e); }
    finally { if (button) button.disabled = false; }
  }
  function closeModal() { const modal = document.querySelector("[data-member-modal]"); if (!modal) return; modal.hidden = true; document.body.classList.remove("modal-open"); lastTrigger?.focus(); }

  function initializeView(view) {
    if (view === "dashboard") {
      loadRecommendations();
      loadDiscoverBooks();
    }
    if (view === "collections") {
      const list = document.querySelector("[data-member-categories]");
      list?.addEventListener("click", (event) => { const button = event.target.closest("[data-collection-id]"); if (!button) return; list.querySelectorAll(".collection-choice").forEach((item) => item.classList.remove("is-active")); button.classList.add("is-active"); loadCollectionBooks(button.dataset.collectionId); });
      loadCollections();
    }
    if (view === "history") renderHistory();
    if (view === "profile") renderProfile();
  }

  document.addEventListener("click", (event) => { const bookmark = event.target.closest("[data-bookmark-id]"); if (bookmark) { const id = String(bookmark.dataset.bookmarkId); bookmarks.has(id) ? bookmarks.delete(id) : bookmarks.add(id); saveBookmarks(); refreshLocalSections(); return; } const open = event.target.closest("[data-book-id]"); if (open) openBook(String(open.dataset.bookId), open); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeModal(); });
  window.addEventListener("hashchange", () => activateView(currentView()));

  const name = document.querySelector("[data-member-name]"); if (name) name.textContent = preview?.user?.username || "reader";
  document.querySelector("[data-refresh-recommendations]")?.addEventListener("click", () => loadRecommendations());
  refreshLocalSections();
  activateView(currentView());
});
