"use strict";

/* Local demonstration data only. It does not represent authentication or API responses. */
(function setupLibraryPreview() {
  const memberPages = new Set(["member.html"]);
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  const librarianPages = new Set(["librarian.html"]);
  if (librarianPages.has(currentPage)) {
    const books = [
      { BookID: "preview-l-1", Title: "The Shape of Ideas", Author: "Mira Sen", GenreName: "Design", CategoryID: "Design", Format: "EPUB", ISBN: "978000000001", Publisher: "North House", FileSizeMB: 3.2, AccessCount: 18, Description: "A quiet study of how ideas become visible in the spaces we make." },
      { BookID: "preview-l-2", Title: "Field Notes on Attention", Author: "Jon Bell", GenreName: "Psychology", CategoryID: "Psychology", Format: "PDF", ISBN: "978000000002", Publisher: "Common Room", FileSizeMB: 2.1, AccessCount: 11, Description: "Short essays on focus, distraction, and the value of looking closely." },
      { BookID: "preview-l-3", Title: "A Brief Atlas of Light", Author: "Nora Hale", GenreName: "Science", CategoryID: "Science", Format: "EPUB", ISBN: "978000000003", Publisher: "Field Press", FileSizeMB: 4.6, AccessCount: 27, Description: "An accessible journey through the physics and poetry of light." },
      { BookID: "preview-l-4", Title: "Cities for Listening", Author: "Ari Okafor", GenreName: "Architecture", CategoryID: "Architecture", Format: "PDF", ISBN: "978000000004", Publisher: "Civic Editions", FileSizeMB: 5.4, AccessCount: 8, Description: "The sounds, rhythms, and hidden conversations that shape urban life." },
    ];
    window.libraryDemo = { role: "Librarian", user: { userId: "preview-librarian", username: "Priya", email: "priya.preview@example.test", role: "Librarian" }, books, categories: books.map((book) => ({ CategoryID: book.CategoryID, GenreName: book.GenreName, BookCount: 1 })), members: [
      { MemberID: "preview-m-1", UserID: "preview-u-1", Username: "aarav", Email: "aarav@example.test", FullName: "Aarav Mehta", SubscriptionTier: "Premium", RegistrationDate: "2026-01-12", LastActiveDate: "2026-09-20", IsVerified: 1, Department: "Information Technology", IsActive: 1 },
      { MemberID: "preview-m-2", UserID: "preview-u-2", Username: "sana", Email: "sana@example.test", FullName: "Sana Iyer", SubscriptionTier: "Free", RegistrationDate: "2026-03-07", LastActiveDate: "2026-09-18", IsVerified: 1, Department: "Computer Science", IsActive: 1 },
      { MemberID: "preview-m-3", UserID: "preview-u-3", Username: "kabir", Email: "kabir@example.test", FullName: "Kabir Shah", SubscriptionTier: "Free", RegistrationDate: "2026-05-21", LastActiveDate: "2026-09-11", IsVerified: 0, Department: "Design", IsActive: 1 },
    ] }; return;
  }
  if (!memberPages.has(currentPage)) return;

  const books = [
    { BookID: "preview-1", Title: "The Shape of Ideas", Author: "Mira Sen", GenreName: "Design", Format: "EPUB", TotalPages: 248, Description: "A quiet study of how ideas become visible in the spaces we make." },
    { BookID: "preview-2", Title: "Field Notes on Attention", Author: "Jon Bell", GenreName: "Psychology", Format: "PDF", TotalPages: 176, Description: "Short essays on focus, distraction, and the value of looking closely." },
    { BookID: "preview-3", Title: "A Brief Atlas of Light", Author: "Nora Hale", GenreName: "Science", Format: "EPUB", TotalPages: 312, Description: "An accessible journey through the physics and poetry of light." },
    { BookID: "preview-4", Title: "Cities for Listening", Author: "Ari Okafor", GenreName: "Architecture", Format: "PDF", TotalPages: 204, Description: "The sounds, rhythms, and hidden conversations that shape urban life." },
  ];

  window.libraryDemo = {
    role: "Member",
    user: { userId: "preview-member", username: "Aarav", email: "aarav.preview@example.test", role: "Member" },
    books,
    categories: [
      { CategoryID: "Design", GenreName: "Design", BookCount: 1 },
      { CategoryID: "Psychology", GenreName: "Psychology", BookCount: 1 },
      { CategoryID: "Science", GenreName: "Science", BookCount: 1 },
      { CategoryID: "Architecture", GenreName: "Architecture", BookCount: 1 },
    ],
    bookmarks: ["preview-1", "preview-3"],
    recent: [
      { book: books[1], openedAt: "2026-09-21T09:30:00.000Z" },
      { book: books[0], openedAt: "2026-09-18T15:10:00.000Z" },
    ],
  };
})();

