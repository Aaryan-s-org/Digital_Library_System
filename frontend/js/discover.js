"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const bookmarksKey = "digitalLibraryBookmarks";
  const recentKey = "digitalLibraryRecentBooks";

  const e = {
    form: document.querySelector("[data-search-form]"),
    search: document.querySelector("#catalogue-search"),
    categoryList: document.querySelector("[data-category-list]"),
    clearCategory: document.querySelector("[data-clear-category]"),
    grid: document.querySelector("[data-book-grid]"),
    carouselsContainer: document.querySelector("[data-category-carousels]"),
    viewToggles: document.querySelectorAll("[data-view-mode]"),
    loading: document.querySelector("[data-books-loading]"),
    error: document.querySelector("[data-books-error]"),
    errorMessage: document.querySelector("[data-books-error-message]"),
    empty: document.querySelector("[data-books-empty]"),
    pagination: document.querySelector("[data-pagination]"),
    summary: document.querySelector("[data-results-summary]"),
    retry: document.querySelector("[data-retry-books]"),
    clearSearch: document.querySelector("[data-clear-search]"),
    modal: document.querySelector("[data-book-modal]"),
    modalCover: document.querySelector("[data-modal-cover]"),
    modalTitle: document.querySelector("[data-modal-title]"),
    modalAuthor: document.querySelector("[data-modal-author]"),
    modalCategory: document.querySelector("[data-modal-category]"),
    modalDescription: document.querySelector("[data-modal-description]"),
    modalMetadata: document.querySelector("[data-modal-metadata]"),
    modalBookmark: document.querySelector("[data-modal-bookmark]"),
    modalReadLink: document.querySelector("[data-modal-read-link]"),
    modalStatus: document.querySelector("[data-modal-status]")
  };

  const state = {
    page: 1,
    limit: 8,
    search: "",
    category: "",
    viewMode: "grid", // "grid" for overall; switches to "carousel" when a category is selected
    totalPages: 1,
    books: [],
    allBooks: [],
    categories: [],
    requestId: 0,
    activeBookId: null,
    lastTrigger: null
  };

  let bookmarks = new Map();
  let recentBooks = [];
  const carouselTimers = new Map();
  const carouselPaused = new Map();

  function syncViewToggles() {
    e.viewToggles.forEach(btn => {
      btn.classList.toggle("is-active", btn.dataset.viewMode === state.viewMode);
    });
  }

  const loadUserData = async () => {
    if (!API.isAuthenticated()) {
      try {
        const local = JSON.parse(localStorage.getItem(bookmarksKey) || "[]").map(String);
        bookmarks = new Map(local.map(id => [id, null]));
      } catch(err) {}
      try {
        recentBooks = JSON.parse(localStorage.getItem(recentKey) || "[]");
      } catch(err) {}
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
    } catch(err) { console.error(err); }
  };
  loadUserData();

  let searchTimer;

  function updateHeroMetrics() {
    const booksEl = document.querySelector("[data-metric-books]");
    const catsEl = document.querySelector("[data-metric-categories]");
    if (booksEl && state.allBooks.length) booksEl.textContent = state.allBooks.length;
    if (catsEl && state.categories.length) catsEl.textContent = state.categories.length;
  }

  function saveBookmarks() {
    localStorage.setItem(bookmarksKey, JSON.stringify([...bookmarks.keys()]));
  }

  function setBookState(mode, message = "") {
    e.loading.hidden = mode !== "loading";
    e.error.hidden = mode !== "error";
    e.empty.hidden = mode !== "empty";
    if (mode === "error") e.errorMessage.textContent = message;
    if (mode === "loading") {
      e.grid.replaceChildren();
      if (e.carouselsContainer) e.carouselsContainer.innerHTML = "";
    }
  }

  function bookId(book) { return String(book.BookID ?? book.bookId ?? ""); }
  function titleOf(book) { return book.Title || book.title || "Untitled book"; }
  function authorOf(book) { return book.Author || book.author || "Unknown author"; }
  function categoryOf(book) { return book.GenreName || book.category || "General"; }
  function formatOf(book) { return book.Format || book.format || "Digital"; }
  function initials(title = "Book") { return title.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase(); }
  function coverTone(book) {
    const tones = ["sage", "lavender", "charcoal", "ivory"];
    const seed = String(book.BookID || book.bookId || book.Title || "book").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return tones[seed % tones.length];
  }
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }
  function cacheBooks(books) {
    try {
      const cache = JSON.parse(localStorage.getItem("digitalLibraryBookCache") || "{}");
      books.forEach((book) => { const id = bookId(book); if (id) cache[id] = book; });
      localStorage.setItem("digitalLibraryBookCache", JSON.stringify(cache));
    } catch {}
  }
  function recordRecent(book) {
    try {
      const entries = JSON.parse(localStorage.getItem(recentKey) || "[]").filter((entry) => bookId(entry.book) !== bookId(book));
      entries.unshift({ book, openedAt: new Date().toISOString() });
      localStorage.setItem(recentKey, JSON.stringify(entries.slice(0, 20)));
    } catch {}
  }

  function renderCategories() {
    if (!state.categories.length) {
      e.categoryList.innerHTML = '<span class="state-copy">No subjects are available yet.</span>';
      return;
    }
    e.categoryList.innerHTML = `
      <button class="category-link ${state.category === "" ? "is-active" : ""}" type="button" data-category-id="">All subjects <span>→</span></button>
      ${state.categories.map((category) => {
        const id = String(category.CategoryID ?? category.categoryId ?? "");
        const name = category.GenreName || category.name || "Untitled subject";
        const count = category.BookCount ?? category.bookCount;
        return `<button class="category-link ${state.category === id ? "is-active" : ""}" type="button" data-category-id="${id}">${escapeHtml(name)}${count == null ? "" : `<span>${count}</span>`}</button>`;
      }).join("")}
    `;
    e.clearCategory.hidden = state.category === "";
  }

  function renderBookCard(book) {
    const id = bookId(book);
    const title = titleOf(book);
    const saved = bookmarks.has(id);
    const matchPct = book.matchPercentage ? `${book.matchPercentage}% Match` : '';
    const matchBadge = matchPct ? `<span class="match-chip ${book.matchPercentage >= 85 ? 'match-chip--high' : ''}">${escapeHtml(matchPct)}</span>` : '';
    const reasonHtml = book.reason ? `<span class="recommendation-reason" title="${escapeHtml(book.reason)}">${escapeHtml(book.reason)}</span>` : '';
    const isExclusive = Boolean(book.IsExclusive);
    const exclusiveBadge = isExclusive ? `<span class="exclusive-pill" style="position:absolute;top:10px;left:10px;z-index:3;">Exclusive</span>` : '';

    return `
      <article class="book-card">
        <button class="book-card__open" type="button" data-book-id="${escapeHtml(id)}" aria-label="View details for ${escapeHtml(title)}">
          <span class="book-cover book-cover--${coverTone(book)}" aria-hidden="true">
            ${exclusiveBadge}
            ${matchBadge}
            ${book.CoverImagePath
              ? `<img src="${escapeHtml(book.CoverImagePath)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit;z-index:1;" />`
              : `<span class="book-cover__initials">${escapeHtml(initials(title))}</span><span class="book-cover__format">${escapeHtml(formatOf(book))}</span>`
            }
          </span>
          <span class="book-card__meta">
            <span class="book-card__category" ${book.CategoryID ? `data-category-filter="${escapeHtml(book.CategoryID)}" title="Browse ${escapeHtml(categoryOf(book))} auto-carousel"` : ''}>${escapeHtml(categoryOf(book))}</span>
            <span class="book-card__title">${escapeHtml(title)}</span>
            <span class="book-card__author">${escapeHtml(authorOf(book))}</span>
            ${reasonHtml}
          </span>
        </button>
        <button class="book-card__bookmark ${saved ? "is-saved" : ""}" type="button" data-bookmark-id="${escapeHtml(id)}" aria-label="${saved ? "Remove" : "Save"} ${escapeHtml(title)} bookmark" aria-pressed="${saved}">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="${saved ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.7">
            <path d="M6.5 4.75A2.25 2.25 0 0 1 8.75 2.5h6.5a2.25 2.25 0 0 1 2.25 2.25v16.5l-5.75-3.5L6 21.25V4.75Z"></path>
          </svg>
        </button>
      </article>
    `;
  }

  function renderBooks() {
    e.grid.innerHTML = state.books.map(renderBookCard).join("");
  }

  function renderPagination() {
    if (state.totalPages <= 1) {
      e.pagination.hidden = true;
      e.pagination.replaceChildren();
      return;
    }
    e.pagination.hidden = false;
    const previous = state.page > 1 ? `<button type="button" class="pagination__button" data-page="${state.page - 1}" aria-label="Previous page">←</button>` : "";
    const next = state.page < state.totalPages ? `<button type="button" class="pagination__button" data-page="${state.page + 1}" aria-label="Next page">→</button>` : "";
    e.pagination.innerHTML = `${previous}<span>Page ${state.page} of ${state.totalPages}</span>${next}`;
  }

  function updateSummary(total) {
    if (e.summary) {
      e.summary.textContent = total ? `${total.toLocaleString()} ${total === 1 ? "book" : "books"}` : "";
    }
  }

  async function getJson(url) {
    const response = await fetch(url);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) throw new Error(payload.message || "The library service is unavailable.");
    return payload;
  }

  async function loadCategories() {
    try {
      const payload = await getJson("/api/categories");
      state.categories = Array.isArray(payload.data) ? payload.data : [];
      renderCategories();
      updateHeroMetrics();
    } catch {
      e.categoryList.innerHTML = '<span class="state-copy">Subjects are unavailable right now.</span>';
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Auto-Sliding Category Carousels Implementation
  // ─────────────────────────────────────────────────────────────
  function clearAllCarouselTimers() {
    carouselTimers.forEach(timer => clearInterval(timer));
    carouselTimers.clear();
  }

  function setupCarousel(catId, viewport, track, interval = 3500) {
    if (!viewport || !track) return { slideNext: () => {}, slidePrev: () => {} };

    function getStep() {
      const card = track.querySelector(".book-card");
      return card ? card.offsetWidth + 20 : 240;
    }

    function slideNext() {
      if (carouselPaused.get(catId)) return;
      const maxScroll = viewport.scrollWidth - viewport.clientWidth;
      if (maxScroll <= 0) return;

      if (viewport.scrollLeft >= maxScroll - 12) {
        viewport.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        viewport.scrollBy({ left: getStep(), behavior: "smooth" });
      }
    }

    function slidePrev() {
      if (viewport.scrollLeft <= 5) {
        viewport.scrollTo({ left: viewport.scrollWidth, behavior: "smooth" });
      } else {
        viewport.scrollBy({ left: -getStep(), behavior: "smooth" });
      }
    }

    // Initialize auto-slide interval
    if (carouselTimers.has(catId)) clearInterval(carouselTimers.get(catId));
    carouselPaused.set(catId, false);
    const timer = setInterval(slideNext, interval);
    carouselTimers.set(catId, timer);

    // Pause on hover
    viewport.addEventListener("mouseenter", () => {
      carouselPaused.set(catId, true);
      updateIndicator(catId, true);
    });

    viewport.addEventListener("mouseleave", () => {
      if (viewport.dataset.explicitPause !== "true") {
        carouselPaused.set(catId, false);
        updateIndicator(catId, false);
      }
    });

    // Pause on touch
    viewport.addEventListener("touchstart", () => {
      carouselPaused.set(catId, true);
      updateIndicator(catId, true);
    }, { passive: true });

    viewport.addEventListener("touchend", () => {
      if (viewport.dataset.explicitPause !== "true") {
        setTimeout(() => {
          carouselPaused.set(catId, false);
          updateIndicator(catId, false);
        }, 1200);
      }
    }, { passive: true });

    return { slideNext, slidePrev };
  }

  function updateIndicator(catId, isPaused) {
    const section = document.querySelector(`[data-cat-id="${catId}"]`);
    if (!section) return;
    const ind = section.querySelector(".carousel-auto-indicator");
    const pauseBtn = section.querySelector(`[data-carousel-toggle="${catId}"]`);
    if (ind) {
      ind.classList.toggle("is-paused", isPaused);
      ind.innerHTML = isPaused
        ? `<span class="auto-indicator-dot"></span> Paused`
        : `<span class="auto-indicator-dot"></span> Auto-sliding`;
    }
    if (pauseBtn) {
      pauseBtn.textContent = isPaused ? "Play" : "Pause";
      pauseBtn.title = isPaused ? "Resume auto-sliding" : "Pause auto-sliding";
      pauseBtn.setAttribute("aria-label", isPaused ? "Resume auto-sliding" : "Pause auto-sliding");
    }
  }

  function renderCategoryCarousel(cat, books) {
    clearAllCarouselTimers();
    if (!e.carouselsContainer) return;
    if (!books.length) {
      e.carouselsContainer.innerHTML = '<div class="state-copy">No books available in this subject.</div>';
      return;
    }

    const catId = String(cat.CategoryID || cat.id || state.category);
    const catName = cat.GenreName || cat.name || "Subject Collection";

    // Loop cards up to at least 7 for smooth continuous gliding across wide screens
    let displayList = [...books];
    while (displayList.length < 7) {
      displayList = displayList.concat(books);
    }

    const cardsHtml = displayList.map(renderBookCard).join("");

    e.carouselsContainer.innerHTML = `
      <section class="category-carousel-section" data-cat-id="${escapeHtml(catId)}">
        <div class="category-carousel-header">
          <div class="category-carousel-title-group">
            <div>
              <p class="category-carousel-eyebrow">Subject Showcase</p>
              <h3 class="category-carousel-title">${escapeHtml(catName)}</h3>
            </div>
            <span class="category-carousel-count">${books.length} ${books.length === 1 ? 'title' : 'titles'}</span>
            <span class="carousel-auto-indicator" title="Auto-sliding active">
              <span class="auto-indicator-dot"></span> Auto-sliding
            </span>
          </div>
          <div class="category-carousel-actions">
            <button class="carousel-control-btn carousel-control-btn--prev" type="button" data-carousel-prev="${escapeHtml(catId)}" aria-label="Previous ${escapeHtml(catName)} books" title="Previous books">&lsaquo;</button>
            <button class="carousel-control-btn carousel-control-btn--pause" type="button" data-carousel-toggle="${escapeHtml(catId)}" aria-label="Pause auto-slide" title="Pause / Resume auto-sliding">Pause</button>
            <button class="carousel-control-btn carousel-control-btn--next" type="button" data-carousel-next="${escapeHtml(catId)}" aria-label="Next ${escapeHtml(catName)} books" title="Next books">&rsaquo;</button>
            <button class="category-clear-pill" type="button" data-clear-selected-cat title="Show all subjects">All subjects</button>
          </div>
        </div>
        <div class="category-carousel-viewport" data-viewport="${escapeHtml(catId)}">
          <div class="category-carousel-track" data-track="${escapeHtml(catId)}">
            ${cardsHtml}
          </div>
        </div>
      </section>
    `;

    const viewport = e.carouselsContainer.querySelector(`[data-viewport="${catId}"]`);
    const track = e.carouselsContainer.querySelector(`[data-track="${catId}"]`);
    const prevBtn = e.carouselsContainer.querySelector(`[data-carousel-prev="${catId}"]`);
    const nextBtn = e.carouselsContainer.querySelector(`[data-carousel-next="${catId}"]`);
    const toggleBtn = e.carouselsContainer.querySelector(`[data-carousel-toggle="${catId}"]`);
    const clearBtn = e.carouselsContainer.querySelector(`[data-clear-selected-cat]`);

    if (!viewport || !track) return;

    const controls = setupCarousel(catId, viewport, track, 3400);

    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        controls.slidePrev();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        controls.slideNext();
      });
    }
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        const currentlyPaused = carouselPaused.get(catId);
        const nextState = !currentlyPaused;
        carouselPaused.set(catId, nextState);
        viewport.dataset.explicitPause = String(nextState);
        updateIndicator(catId, nextState);
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        state.category = "";
        state.page = 1;
        state.viewMode = "grid";
        renderCategories();
        syncViewToggles();
        loadBooks();
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Recommendations Spotlight
  // ─────────────────────────────────────────────────────────────
  async function loadSpotlightRecommendations() {
    const spotlightSection = document.querySelector("[data-ai-spotlight]");
    const spotlightGrid = document.querySelector("[data-spotlight-grid]");
    const spotlightReason = document.querySelector("[data-spotlight-reason]");
    if (!spotlightSection || !spotlightGrid) return;

    let clientSearches = [];
    try {
      clientSearches = JSON.parse(localStorage.getItem("digitalLibrarySearchHistory") || "[]");
    } catch (err) {}

    let localReads = [];
    try {
      localReads = JSON.parse(localStorage.getItem(recentKey) || "[]").map(r => bookId(r.book)).filter(Boolean);
    } catch (err) {}

    const hasSignals = clientSearches.length > 0 || localReads.length > 0 || (typeof API !== 'undefined' && API.isAuthenticated());

    try {
      const payload = await (typeof API !== 'undefined' && API.getRecommendations
        ? API.getRecommendations({
            limit: 4,
            searches: clientSearches.map(s => s.query).filter(Boolean),
            recentReads: localReads
          })
        : getJson("/api/recommendations?limit=4"));

      const recs = Array.isArray(payload?.data) ? payload.data : [];
      if (!recs.length || (!hasSignals && recs.every(r => r.recommendationScore < 0.05))) {
        spotlightSection.hidden = true;
        return;
      }

      spotlightSection.hidden = false;
      cacheBooks(recs);

      if (spotlightReason && payload.signalsUsed) {
        const { searchesCount = 0, recentReadsCount = 0 } = payload.signalsUsed;
        if (searchesCount > 0 && recentReadsCount > 0) {
          spotlightReason.textContent = `Generated by ML model from ${recentReadsCount} recent ${recentReadsCount === 1 ? 'read' : 'reads'} & ${searchesCount} ${searchesCount === 1 ? 'search' : 'searches'}`;
        } else if (searchesCount > 0) {
          spotlightReason.textContent = `Generated by ML model matching recent searches`;
        } else if (recentReadsCount > 0) {
          spotlightReason.textContent = `Generated by ML model matching your reading history`;
        } else {
          spotlightReason.textContent = `Curated based on catalogue popularity`;
        }
      }

      spotlightGrid.innerHTML = recs.map(renderBookCard).join("");
    } catch (err) {
      spotlightSection.hidden = true;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Main Load Books Handler
  // ─────────────────────────────────────────────────────────────
  async function loadBooks() { 
    const requestId = ++state.requestId; 
    setBookState("loading"); 

    // Fetch full catalogue for local cache if not yet cached
    if (!state.allBooks.length) {
      try {
        const allPayload = await getJson("/api/books?page=1&limit=100");
        state.allBooks = Array.isArray(allPayload.data) ? allPayload.data : [];
        cacheBooks(state.allBooks);
        updateHeroMetrics();
      } catch (e) {
        console.warn("Could not fetch full catalogue:", e);
      }
    }

    // CASE 1: A Category IS selected!
    if (state.category) {
      const catObj = state.categories.find(c => String(c.CategoryID) === String(state.category)) || {
        CategoryID: state.category,
        GenreName: state.allBooks.find(b => String(b.CategoryID) === String(state.category))?.GenreName || "Selected Subject"
      };

      let categoryBooks = [];
      try {
        const catPayload = await getJson(`/api/books?category=${encodeURIComponent(state.category)}&limit=50${state.search ? `&search=${encodeURIComponent(state.search)}` : ''}`);
        categoryBooks = Array.isArray(catPayload.data) ? catPayload.data : [];
        cacheBooks(categoryBooks);
      } catch (err) {
        categoryBooks = state.allBooks.filter(b => String(b.CategoryID) === String(state.category));
      }

      if (requestId !== state.requestId) return;

      if (!categoryBooks.length) {
        clearAllCarouselTimers();
        if (e.carouselsContainer) e.carouselsContainer.hidden = true;
        if (e.grid) e.grid.hidden = true;
        if (e.pagination) e.pagination.hidden = true;
        setBookState("empty");
        updateSummary(0);
        syncViewToggles();
        return;
      }

      setBookState("ready");
      updateSummary(categoryBooks.length);
      syncViewToggles();

      if (state.viewMode === "carousel") {
        if (e.grid) e.grid.hidden = true;
        if (e.pagination) e.pagination.hidden = true;
        if (e.carouselsContainer) {
          e.carouselsContainer.hidden = false;
          renderCategoryCarousel(catObj, categoryBooks);
        }
      } else {
        // Grid mode for this category
        clearAllCarouselTimers();
        if (e.carouselsContainer) {
          e.carouselsContainer.hidden = true;
          e.carouselsContainer.innerHTML = "";
        }
        if (e.grid) {
          e.grid.hidden = false;
          e.grid.innerHTML = categoryBooks.map(renderBookCard).join("");
        }
        if (e.pagination) e.pagination.hidden = true;
      }
      return;
    }

    // CASE 2: Overall Catalogue (NO category selected / "All subjects")
    // "not overall": overall is standard paginated grid, NO carousels
    clearAllCarouselTimers();
    if (e.carouselsContainer) {
      e.carouselsContainer.hidden = true;
      e.carouselsContainer.innerHTML = "";
    }
    if (e.grid) e.grid.hidden = false;
    syncViewToggles();

    const params = new URLSearchParams({ page: String(state.page), limit: String(state.limit) }); 
    if (state.search) params.set("search", state.search); 

    try { 
      const payload = await getJson(`/api/books?${params.toString()}`); 
      if (requestId !== state.requestId) return; 
      state.books = Array.isArray(payload.data) ? payload.data : []; 
      cacheBooks(state.books); 
      const pagination = payload.pagination || {}; 
      state.totalPages = Math.max(1, Number(pagination.pages) || 1); 
      updateSummary(Number(pagination.total) || state.books.length); 

      // Track search with ML recommendation service
      if (state.search && typeof API !== 'undefined' && API.trackSearch) {
        API.trackSearch(state.search, null, Number(pagination.total) || state.books.length)
          .then(() => loadSpotlightRecommendations())
          .catch(() => {});
      }

      if (!state.books.length) {
        setBookState("empty");
        renderPagination();
        return;
      } 
      setBookState("ready"); 
      renderBooks(); 
      renderPagination(); 
    } catch (error) { 
      if (requestId !== state.requestId) return; 
      updateSummary(0); 
      setBookState("error", error.message || "The catalogue is unavailable right now."); 
    } 
  }

  function setSearch(value) {
    state.search = value.trim();
    state.page = 1;
    loadBooks();
  }

  async function openBook(id, trigger) { 
    state.activeBookId = id; 
    state.lastTrigger = trigger; 
    e.modal.hidden = false; 
    document.body.classList.add("modal-open"); 
    e.modalTitle.textContent = "Loading details…"; 
    e.modalAuthor.textContent = ""; 
    e.modalDescription.textContent = "Fetching book information…"; 
    e.modalMetadata.replaceChildren(); 
    e.modalBookmark.disabled = true; 
    e.modal.querySelector(".book-modal__close").focus(); 

    try { 
      const payload = await getJson(`/api/books/${encodeURIComponent(id)}`); 
      const book = payload.data || {}; 
      cacheBooks([book]); 
      recordRecent(book); 
      loadSpotlightRecommendations();
      const title = titleOf(book); 
      e.modalTitle.textContent = title; 
      e.modalAuthor.textContent = authorOf(book); 
      e.modalCategory.textContent = categoryOf(book); 
      e.modalDescription.textContent = book.Description || book.description || "Book details are available in the catalogue record."; 
      e.modalCover.className = `book-cover book-cover--modal book-cover--${coverTone(book)}`; 
      e.modalCover.innerHTML = book.CoverImagePath ? `<img src="${escapeHtml(book.CoverImagePath)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit;z-index:1;" />` : `<span class="book-cover__initials">${escapeHtml(initials(title))}</span><span class="book-cover__format">${escapeHtml(formatOf(book))}</span>`; 
      const metadata = [["Format", formatOf(book)], ["ISBN", book.ISBN || book.isbn], ["Pages", book.TotalPages || book.totalPages], ["File size", book.FileSizeMB ? `${book.FileSizeMB} MB` : null]].filter(([, value]) => value != null && value !== ""); 
      e.modalMetadata.innerHTML = metadata.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value))}</dd></div>`).join(""); 

      const isExclusive = Boolean(book.IsExclusive);
      const user = window.API?.getUser ? window.API.getUser() : null;
      const isStaff = user && (user.role === "Admin" || user.role === "Librarian");
      const isPremium = user && user.subscriptionTier === "Premium";
      const isLocked = isExclusive && !isStaff && !isPremium;

      if (e.modalReadLink) {
        if (isLocked) {
          e.modalReadLink.textContent = "Unlock Exclusive with Premium";
          e.modalReadLink.className = "button button--accent";
          e.modalReadLink.href = "#subscribe";
          e.modalReadLink.onclick = (evt) => {
            evt.preventDefault();
            if (window.SubscriptionModal) {
              window.SubscriptionModal.open({
                bookTitle: title,
                bookId: id,
                onSuccess: () => {
                  window.location.href = `reader.html?id=${encodeURIComponent(id)}`;
                }
              });
            }
          };
        } else {
          e.modalReadLink.textContent = "Read in Browser";
          e.modalReadLink.className = "button button--primary";
          e.modalReadLink.href = `reader.html?id=${encodeURIComponent(id)}`;
          e.modalReadLink.onclick = null;
        }
      }
      if (e.modalStatus) {
        if (isExclusive) {
          e.modalStatus.innerHTML = `<span class="exclusive-pill">Exclusive Edition</span>`;
        } else {
          const available = book.AvailableCopies > 0 || book.AvailableCopies === undefined;
          e.modalStatus.textContent = available ? "Available for instant online reading" : "Currently on loan (reserve in catalog)";
          e.modalStatus.style.color = available ? "var(--color-primary-dark, #2b6cb0)" : "var(--color-warning, #d69e2e)";
        }
      }

      updateModalBookmark(); 
    } catch (error) { 
      e.modalDescription.textContent = error.message || "Book details are unavailable right now."; 
      e.modalCategory.textContent = "Book details"; 
      if (e.modalStatus) {
        e.modalStatus.textContent = "Status unavailable";
      }
    } finally { 
      e.modalBookmark.disabled = false; 
    } 
  }

  function updateModalBookmark() {
    const saved = bookmarks.has(String(state.activeBookId));
    e.modalBookmark.textContent = saved ? "Remove bookmark" : "Save bookmark";
    e.modalBookmark.setAttribute("aria-pressed", String(saved));
  }

  function closeModal() {
    e.modal.hidden = true;
    document.body.classList.remove("modal-open");
    state.lastTrigger?.focus();
  }

  // ─────────────────────────────────────────────────────────────
  // Event Listeners
  // ─────────────────────────────────────────────────────────────
  e.form.addEventListener("submit", (event) => {
    event.preventDefault();
    setSearch(e.search.value);
  });

  e.search.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => setSearch(e.search.value), 350);
  });

  e.categoryList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category-id]");
    if (!button) return;
    const catId = button.dataset.categoryId;
    state.category = catId;
    state.page = 1;
    // When a category is selected, default to auto-sliding carousel mode!
    state.viewMode = catId ? "carousel" : "grid";
    renderCategories();
    syncViewToggles();
    loadBooks();
  });

  e.clearCategory.addEventListener("click", () => {
    state.category = "";
    state.page = 1;
    state.viewMode = "grid";
    renderCategories();
    syncViewToggles();
    loadBooks();
  });

  e.retry.addEventListener("click", loadBooks);

  e.clearSearch.addEventListener("click", () => {
    e.search.value = "";
    setSearch("");
  });

  e.pagination.addEventListener("click", (event) => {
    const button = event.target.closest("[data-page]");
    if (!button) return;
    state.page = Number(button.dataset.page);
    loadBooks();
    document.querySelector(".catalogue-section").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // View Mode Toggle (Carousel vs Grid)
  e.viewToggles.forEach(btn => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.viewMode;
      if (state.viewMode === mode) return;
      state.viewMode = mode;
      // If user clicks "carousel" but no category is selected yet,
      // select the first category with books!
      if (mode === "carousel" && !state.category && state.categories.length) {
        const firstWithBooks = state.categories.find(c => (c.BookCount || c.bookCount) > 0) || state.categories[0];
        if (firstWithBooks) {
          state.category = String(firstWithBooks.CategoryID || firstWithBooks.categoryId);
          renderCategories();
        }
      }
      syncViewToggles();
      loadBooks();
    });
  });

  // Global Click delegation for book open, category filtering & bookmarking
  document.addEventListener("click", (event) => {
    // Click on category tag on any book card to view its carousel
    const catTag = event.target.closest("[data-category-filter]");
    if (catTag && catTag.dataset.categoryFilter) {
      event.preventDefault();
      event.stopPropagation();
      state.category = catTag.dataset.categoryFilter;
      state.viewMode = "carousel";
      state.page = 1;
      renderCategories();
      syncViewToggles();
      loadBooks();
      document.querySelector(".catalogue-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const bookmark = event.target.closest("[data-bookmark-id]");
    if (bookmark) {
      const id = String(bookmark.dataset.bookmarkId);
      bookmarks.has(id) ? bookmarks.delete(id) : bookmarks.set(id, null);
      saveBookmarks();
      renderBooks();
      // Update bookmark state in active carousels
      document.querySelectorAll(`[data-bookmark-id="${id}"]`).forEach(btn => {
        const isSaved = bookmarks.has(id);
        btn.classList.toggle("is-saved", isSaved);
        btn.setAttribute("aria-pressed", String(isSaved));
        btn.querySelector("svg").setAttribute("fill", isSaved ? "currentColor" : "none");
      });
      loadSpotlightRecommendations();
      return;
    }
    const open = event.target.closest("[data-book-id]");
    if (open) openBook(String(open.dataset.bookId), open);
  });

  document.querySelectorAll("[data-modal-close]").forEach((button) => button.addEventListener("click", closeModal));
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !e.modal.hidden) closeModal(); });

  e.modalBookmark.addEventListener("click", () => {
    const id = String(state.activeBookId);
    bookmarks.has(id) ? bookmarks.delete(id) : bookmarks.set(id, null);
    saveBookmarks();
    updateModalBookmark();
    renderBooks();
    document.querySelectorAll(`[data-bookmark-id="${id}"]`).forEach(btn => {
      const isSaved = bookmarks.has(id);
      btn.classList.toggle("is-saved", isSaved);
      btn.setAttribute("aria-pressed", String(isSaved));
      btn.querySelector("svg").setAttribute("fill", isSaved ? "currentColor" : "none");
    });
    loadSpotlightRecommendations();
  });

  renderCategories(); 
  loadCategories(); 
  loadBooks();
  loadSpotlightRecommendations();
});
