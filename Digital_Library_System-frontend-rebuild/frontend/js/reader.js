"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const books = {
    "1": { id: "1", title: "The Shape of Ideas", author: "Mira Sen", format: "EPUB", category: "Design", pages: [
      ["Ideas rarely arrive as finished objects. More often, they gather at the edge of attention: a note in the margin, a question that refuses to leave, a shape noticed twice in different places."],
      ["To give an idea form is not to make it rigid. It is to offer it a surface where another person can meet it. The best forms leave a little room around themselves, enough space for curiosity to enter."],
      ["A useful library is made from the same generosity. It does not simply store what has been written; it creates a quiet arrangement in which one thought can lead to another."],
      ["The work of reading is therefore also a work of making. Each page becomes part of a private map, and every return to a familiar sentence redraws the route."],
    ] },
    "2": { id: "2", title: "Field Notes on Attention", author: "Jon Bell", format: "PDF", category: "Psychology", pages: [
      ["Attention is less like a spotlight than a room with a door. We decide what enters, but the room is always being changed by what has already arrived."],
      ["A short pause can be a method. Before beginning, notice the surface beneath your hands, the temperature of the air, and the shape of the next small task."],
      ["The mind returns more willingly when it is not treated as a machine. Focus grows through rhythm: effort, rest, and the gentle decision to begin again."],
    ] },
    "3": { id: "3", title: "A Brief Atlas of Light", author: "Nora Hale", format: "EPUB", category: "Science", pages: [
      ["Light gives the world its edges, but it also reveals how uncertain those edges can be. A window at dusk is both a boundary and an invitation."],
      ["In the laboratory, a beam can be measured. In a room, its meaning changes with every surface it touches, carrying the memory of weather and time."],
      ["To study light is to study relation: source and surface, distance and shadow, the visible fact and the unseen journey that made it possible."],
    ] },
    "4": { id: "4", title: "Cities for Listening", author: "Ari Okafor", format: "PDF", category: "Architecture", pages: [
      ["A city is often described by its skyline, but its deeper character is carried by sound. Doors, footsteps, engines, bells, and voices make a map no photograph can hold."],
      ["Listening changes the pace of a street. What seemed like background becomes information: a courtyard opening, a bus arriving, a conversation turning a corner."],
      ["The attentive city is not quieter. It is more legible. It gives its inhabitants enough texture to feel where they are and enough variation to remain awake."],
    ] },
  };
  const params = new URLSearchParams(window.location.search); const requested = params.get("book") || "1"; const book = books[requested] || books["1"];
  const key = `digitalLibraryReader:${book.id}`; const bookmarkKey = "digitalLibraryBookmarks"; const historyKey = "digitalLibraryRecentBooks";
  const content = document.querySelector("[data-reader-content]"), progress = document.querySelector("[data-reader-progress]"), progressLabel = document.querySelector("[data-reader-progress-label]"), pageLabel = document.querySelector("[data-reader-page-label]"), prev = document.querySelector("[data-reader-prev]"), next = document.querySelector("[data-reader-next]"), bookmark = document.querySelector("[data-reader-bookmark]"), settings = document.querySelector("[data-reader-settings-panel]");
  let state; try { state = JSON.parse(localStorage.getItem(key) || "{}"); } catch { state = {}; }
  let page = Math.min(Math.max(Number(state.page) || 0, 0), book.pages.length - 1);
  const escape = (value) => String(value).replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]);
  document.querySelector("[data-reader-title]").textContent = book.title; document.querySelector("[data-reader-author]").textContent = book.author; document.querySelector("[data-reader-format]").textContent = book.format; document.querySelector("[data-reader-category]").textContent = book.category;
  const userId = localStorage.getItem("digitalLibraryDemoReaderId") || "demo-reader"; document.querySelector("[data-reader-watermark]").textContent = `Demo copy · ${userId} · ${book.id}`;
  function readBookmarks() { try { return new Set(JSON.parse(localStorage.getItem(bookmarkKey) || "[]").map(String)); } catch { return new Set(); } }
  function setBookmark() { const saved = readBookmarks(); const aliases = new Set([book.id, `preview-${book.id}`, `admin-demo-${book.id}`]); const isSaved = [...aliases].some((id) => saved.has(id)); aliases.forEach((id) => isSaved ? saved.delete(id) : saved.add(id)); localStorage.setItem(bookmarkKey, JSON.stringify([...saved])); bookmark.classList.toggle("is-active", !isSaved); bookmark.setAttribute("aria-pressed", String(!isSaved)); bookmark.querySelector("span").textContent = !isSaved ? "Bookmarked" : "Bookmark"; }
  function recordHistory() { let entries = []; try { entries = JSON.parse(localStorage.getItem(historyKey) || "[]"); } catch {} entries = entries.filter((entry) => String(entry.book?.BookID ?? entry.book?.bookId ?? "") !== book.id); entries.unshift({ book: { BookID: book.id, Title: book.title, Author: book.author, Format: book.format, GenreName: book.category }, openedAt: new Date().toISOString() }); localStorage.setItem(historyKey, JSON.stringify(entries.slice(0, 20))); }
  function render() { const percentage = Math.round(((page + 1) / book.pages.length) * 100); content.innerHTML = book.pages[page].map((paragraph) => `<p>${escape(paragraph)}</p>`).join(""); progress.value = percentage; progressLabel.textContent = `Page ${page + 1} of ${book.pages.length}`; pageLabel.textContent = `${percentage}% complete`; prev.disabled = page === 0; next.disabled = page === book.pages.length - 1; localStorage.setItem(key, JSON.stringify({ book: book.id, page, completion: percentage, lastOpened: new Date().toISOString() })); recordHistory(); }
  function changePage(delta) { page = Math.min(Math.max(page + delta, 0), book.pages.length - 1); render(); content.focus(); }
  prev.addEventListener("click", () => changePage(-1)); next.addEventListener("click", () => changePage(1)); content.addEventListener("keydown", (event) => { if (event.key === "ArrowLeft") changePage(-1); if (event.key === "ArrowRight") changePage(1); }); bookmark.addEventListener("click", setBookmark);
  document.querySelector("[data-reader-settings]").addEventListener("click", () => { const open = settings.hidden; settings.hidden = !open; document.querySelector("[data-reader-settings]").setAttribute("aria-expanded", String(open)); }); document.querySelector("[data-reader-settings-close]").addEventListener("click", () => { settings.hidden = true; });
  document.querySelector("[data-reader-size]").addEventListener("input", (event) => { document.documentElement.style.setProperty("--reader-size", `${event.target.value}rem`); }); document.querySelector("[data-reader-width]").addEventListener("input", (event) => { document.documentElement.style.setProperty("--reader-width", `${event.target.value}rem`); }); document.querySelector("[data-reader-quiet]").addEventListener("change", (event) => document.body.classList.toggle("reader-quiet", event.target.checked));
  content.addEventListener("contextmenu", (event) => event.preventDefault()); content.addEventListener("copy", (event) => event.preventDefault()); window.addEventListener("blur", () => content.classList.add("is-obscured")); window.addEventListener("focus", () => content.classList.remove("is-obscured"));
  const saved = readBookmarks(); const aliases = [book.id, `preview-${book.id}`, `admin-demo-${book.id}`]; const isSaved = aliases.some((id) => saved.has(id)); bookmark.classList.toggle("is-active", isSaved); bookmark.setAttribute("aria-pressed", String(isSaved)); bookmark.querySelector("span").textContent = isSaved ? "Bookmarked" : "Bookmark"; render();
});
