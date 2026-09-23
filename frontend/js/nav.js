"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const role = document.body.dataset.protectedRole || null;
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  let header = document.querySelector(".site-header");
  if (!header) { header = document.createElement("header"); header.className = "site-header"; document.body.prepend(header); }

  const publicLinks = [["Discover", "index.html"], ["Collections", "index.html#collections"], ["About / Help", "index.html#about"]];
  const memberLinks = [["Discover", "index.html"], ["My Library", "member.html#library"], ["Collections", "member.html#collections"]];
  const librarianLinks = [["Dashboard", "librarian.html"], ["Catalog", "librarian.html#catalog"], ["Members", "librarian.html#members"]];
  const adminLinks = [["Dashboard", "admin.html"], ["Users & Roles", "admin.html#users"], ["E-books", "admin.html#catalog"], ["Reports", "admin.html#reports"], ["Analytics", "admin.html#analytics"], ["Audit Logs", "admin.html#audit"]];
  const links = role === "Member" ? memberLinks : role === "Librarian" ? librarianLinks : role === "Admin" ? adminLinks : publicLinks;

  const activeFor = (href) => { const [page, hash = ""] = href.split("#"); return page === currentPage && (hash ? window.location.hash.toLowerCase() === `#${hash}` : !window.location.hash); };
  const profileHref = role === "Member" ? "member.html#profile" : role === "Librarian" ? "librarian.html#profile" : "admin.html#profile";

  function render() {
    const currentHash = window.location.hash.toLowerCase();
    const linkMarkup = links.map(([label, href]) => `<a class="nav-link" href="${href}"${activeFor(href) ? ' aria-current="page"' : ""}>${label}</a>`).join("");
    const memberReadingActive = role === "Member" && (currentHash === "#history" || currentHash === "#bookmarks");
    const readingMarkup = role === "Member" ? `<div class="nav-dropdown"><button class="nav-dropdown__toggle" type="button" aria-expanded="false" aria-controls="reading-menu"${memberReadingActive ? ' aria-current="page"' : ""}>Reading <span aria-hidden="true">⌄</span></button><div class="nav-dropdown__menu" id="reading-menu"><a href="member.html#history"${currentHash === "#history" ? ' aria-current="page"' : ""}>History</a><a href="member.html#bookmarks"${currentHash === "#bookmarks" ? ' aria-current="page"' : ""}>Bookmarks</a></div></div>` : role === "Librarian" ? `<div class="nav-dropdown"><button class="nav-dropdown__toggle" type="button" aria-expanded="false" aria-controls="catalog-menu"${currentHash === "#catalog" || currentHash === "#add-ebook" ? ' aria-current="page"' : ""}>Catalog <span aria-hidden="true">⌄</span></button><div class="nav-dropdown__menu" id="catalog-menu"><a href="librarian.html#catalog"${currentHash === "#catalog" ? ' aria-current="page"' : ""}>E-books</a><a href="librarian.html#add-ebook"${currentHash === "#add-ebook" ? ' aria-current="page"' : ""}>Add E-book</a></div></div>` : "";
    const profileActive = role && activeFor(profileHref);
    const bell = `<button class="nav-icon" type="button" data-notifications aria-expanded="false" aria-controls="notifications-popover" aria-label="Open notifications"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M10 21h4"></path></svg></button>`;
    const actionMarkup = role ? `${bell}<a class="nav-profile" href="${profileHref}"${profileActive ? ' aria-current="page"' : ""}>Profile</a><a class="nav-logout" href="index.html">Return to Discover</a>` : `<a class="nav-login" href="login.html">Login</a>`;
    const popoverMarkup = role ? `<div class="nav-popover" id="notifications-popover" role="status" hidden><strong>Notifications</strong><span>Notifications will be connected when the backend endpoint is available.</span></div>` : "";
    header.dataset.menuOpen = "false";
    header.innerHTML = `<nav class="top-nav" aria-label="Primary navigation"><a class="brand" href="index.html" aria-label="Digital Library home"><span class="brand__mark" aria-hidden="true">D</span><span class="brand__name">Digital Library</span></a><div class="nav-links" id="primary-navigation">${linkMarkup}${readingMarkup}</div><div class="nav-actions">${actionMarkup}</div><button class="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-navigation"><span class="nav-toggle__icon" aria-hidden="true"></span><span class="sr-only">Open navigation</span></button></nav>${popoverMarkup}`;
    bindHeaderControls();
  }

  function bindHeaderControls() {
    const toggle = header.querySelector(".nav-toggle");
    const setMenu = (open) => { header.dataset.menuOpen = String(open); toggle.setAttribute("aria-expanded", String(open)); toggle.querySelector(".sr-only").textContent = open ? "Close navigation" : "Open navigation"; };
    toggle.addEventListener("click", () => setMenu(header.dataset.menuOpen !== "true"));
    header.querySelectorAll(".nav-links a, .nav-profile").forEach((link) => link.addEventListener("click", () => setMenu(false)));
    const readingToggle = header.querySelector(".nav-dropdown__toggle");
    if (readingToggle) readingToggle.addEventListener("click", () => { const open = readingToggle.getAttribute("aria-expanded") !== "true"; readingToggle.setAttribute("aria-expanded", String(open)); readingToggle.parentElement.classList.toggle("is-open", open); });
    const notificationButton = header.querySelector("[data-notifications]");
    const popover = header.querySelector("#notifications-popover");
    if (notificationButton && popover) notificationButton.addEventListener("click", () => { const open = popover.hidden; popover.hidden = !open; notificationButton.setAttribute("aria-expanded", String(open)); });
  }

  document.addEventListener("keydown", (event) => { if (event.key !== "Escape") return; header.dataset.menuOpen = "false"; header.querySelector(".nav-toggle")?.setAttribute("aria-expanded", "false"); header.querySelector(".nav-toggle .sr-only")?.replaceChildren(document.createTextNode("Open navigation")); const popover = header.querySelector("#notifications-popover"); const notificationButton = header.querySelector("[data-notifications]"); if (popover) { popover.hidden = true; notificationButton?.setAttribute("aria-expanded", "false"); } });
  window.addEventListener("hashchange", render);
  window.addEventListener("resize", () => { if (window.innerWidth > 768) { header.dataset.menuOpen = "false"; header.querySelector(".nav-toggle")?.setAttribute("aria-expanded", "false"); } });
  render();
});
