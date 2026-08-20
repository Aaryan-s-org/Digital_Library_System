// Dashboard Functionality for Team 1
// Book & Member Management with RBAC

let currentUser = null;
let authToken = null;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
  authToken = localStorage.getItem('token');
  const userData = localStorage.getItem('user');
  
  if (!authToken || !userData) {
    window.location.href = '/index.html';
    return;
  }

  currentUser = JSON.parse(userData);
  document.getElementById('userName').textContent = currentUser.username;
  document.getElementById('userRole').textContent = currentUser.role;

  // Setup sidebar navigation
  setupSidebarNavigation();
  
  // Setup logout
  document.getElementById('logoutBtn').addEventListener('click', logout);

  // Load initial data
  loadDashboardData();
  loadMembers();
  loadBooks();
  loadCategories();
});

// Sidebar navigation
function setupSidebarNavigation() {
  const sidebarItems = document.querySelectorAll('.sidebar-item');
  
  sidebarItems.forEach(item => {
    item.addEventListener('click', () => {
      sidebarItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      
      const section = item.getAttribute('data-section');
      showSection(section);
    });
  });
}

function showSection(sectionName) {
  const sections = document.querySelectorAll('.section');
  sections.forEach(s => s.classList.remove('active'));
  
  const section = document.getElementById(`${sectionName}-section`);
  if (section) {
    section.classList.add('active');
  }
}

// API calls with auth
async function apiCall(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
    ...options.headers
  };

  try {
    const response = await fetch(endpoint, {
      ...options,
      headers
    });

    if (response.status === 401) {
      logout();
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('API call error:', error);
    return null;
  }
}

// Dashboard data loading
async function loadDashboardData() {
  try {
    // Load members stats
    const membersRes = await apiCall('/api/members');
    if (membersRes && membersRes.success) {
      const members = membersRes.data;
      document.getElementById('totalMembers').textContent = members.length;
      document.getElementById('premiumMembers').textContent = members.filter(m => m.SubscriptionTier === 'Premium').length;
      
      // Show recent members
      const recent = members.slice(0, 5);
      const tbody = document.getElementById('recentMembersBody');
      tbody.innerHTML = recent.map(m => `
        <tr>
          <td>${m.FullName}</td>
          <td>${m.Email}</td>
          <td><span class="badge ${m.SubscriptionTier.toLowerCase()}">${m.SubscriptionTier}</span></td>
          <td>${new Date(m.RegistrationDate).toLocaleDateString()}</td>
        </tr>
      `).join('');
    }

    // Load books stats
    const booksRes = await apiCall('/api/books?limit=1');
    if (booksRes && booksRes.success) {
      document.getElementById('totalBooks').textContent = booksRes.pagination.total;
    }

    // Load categories stats
    const categoriesRes = await apiCall('/api/categories');
    if (categoriesRes && categoriesRes.success) {
      document.getElementById('totalCategories').textContent = categoriesRes.data.length;
    }
  } catch (error) {
    console.error('Error loading dashboard data:', error);
  }
}

// Members management
async function loadMembers() {
  try {
    if (currentUser.role === 'Member') return;

    const res = await apiCall('/api/members');
    if (!res || !res.success) return;

    const tbody = document.getElementById('membersBody');
    tbody.innerHTML = res.data.map(member => `
      <tr>
        <td>${member.MemberID}</td>
        <td>${member.FullName}</td>
        <td>${member.Email}</td>
        <td><span class="badge ${member.SubscriptionTier.toLowerCase()}">${member.SubscriptionTier}</span></td>
        <td><span class="badge ${member.IsVerified ? 'badge-success' : 'badge-warning'}">
          ${member.IsVerified ? 'Verified' : 'Pending'}
        </span></td>
        <td>${new Date(member.RegistrationDate).toLocaleDateString()}</td>
        <td>
          <button class="btn secondary" onclick="editMember(${member.MemberID})">Edit</button>
          <button class="btn danger" onclick="deactivateMember(${member.UserID})">Deactivate</button>
        </td>
      </tr>
    `).join('');

    // Setup search
    document.getElementById('memberSearch').addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      const rows = tbody.querySelectorAll('tr');
      rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(query) ? '' : 'none';
      });
    });
  } catch (error) {
    console.error('Error loading members:', error);
  }
}

function editMember(memberId) {
  document.getElementById('memberModal').classList.add('active');
  document.getElementById('memberForm').onsubmit = async (e) => {
    e.preventDefault();
    
    const data = {
      fullName: document.getElementById('memberName').value,
      subscriptionTier: document.getElementById('memberSubscription').value
    };

    const res = await apiCall(`/api/members/${memberId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });

    if (res && res.success) {
      showMessage('membersMessage', 'Member updated successfully', 'success');
      closeMemberModal();
      loadMembers();
    } else {
      showMessage('membersMessage', 'Error updating member', 'error');
    }
  };
}

async function deactivateMember(userId) {
  if (confirm('Are you sure you want to deactivate this user?')) {
    const res = await apiCall(`/api/users/${userId}/deactivate`, { method: 'POST' });
    if (res && res.success) {
      showMessage('membersMessage', 'User deactivated', 'success');
      loadMembers();
    } else {
      showMessage('membersMessage', 'Error deactivating user', 'error');
    }
  }
}

document.getElementById('addMemberBtn').addEventListener('click', () => {
  document.getElementById('memberModal').classList.add('active');
  document.getElementById('memberForm').reset();
  document.querySelector('#memberModal .modal-header').textContent = 'Add Member';
});

function closeMemberModal() {
  document.getElementById('memberModal').classList.remove('active');
}

// Books management
async function loadBooks() {
  try {
    const res = await apiCall('/api/books?limit=50');
    if (!res || !res.success) return;

    const tbody = document.getElementById('booksBody');
    tbody.innerHTML = res.data.map(book => `
      <tr>
        <td>${book.Title}</td>
        <td>${book.Author}</td>
        <td>${book.ISBN}</td>
        <td>${book.GenreName}</td>
        <td>${book.Format}</td>
        <td>${book.FileSizeMB.toFixed(2)} MB</td>
        <td>${book.IsAvailable ? '✓' : '✗'}</td>
        <td>
          ${currentUser.role !== 'Member' ? `
            <button class="btn secondary" onclick="editBook(${book.BookID})">Edit</button>
            <button class="btn danger" onclick="deleteBook(${book.BookID})">Delete</button>
          ` : ''}
        </td>
      </tr>
    `).join('');

    // Setup search
    document.getElementById('bookSearch').addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      const rows = tbody.querySelectorAll('tr');
      rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(query) ? '' : 'none';
      });
    });
  } catch (error) {
    console.error('Error loading books:', error);
  }
}

function editBook(bookId) {
  // Edit book modal
  console.log('Edit book:', bookId);
}

async function deleteBook(bookId) {
  if (confirm('Are you sure you want to delete this book?')) {
    const res = await apiCall(`/api/books/${bookId}`, { method: 'DELETE' });
    if (res && res.success) {
      showMessage('booksMessage', 'Book deleted', 'success');
      loadBooks();
    } else {
      showMessage('booksMessage', 'Error deleting book', 'error');
    }
  }
}

document.getElementById('addBookBtn').addEventListener('click', () => {
  document.getElementById('bookModal').classList.add('active');
  document.getElementById('bookForm').reset();
});

document.getElementById('bookForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData();
  formData.append('title', document.getElementById('bookTitle').value);
  formData.append('author', document.getElementById('bookAuthor').value);
  formData.append('isbn', document.getElementById('bookISBN').value);
  formData.append('categoryId', document.getElementById('bookCategory').value);
  formData.append('format', document.getElementById('bookFormat').value);
  formData.append('filePath', '/secure_ebooks/' + document.getElementById('bookFile').value);
  formData.append('fileSize', document.getElementById('bookFile').files[0]?.size / (1024 * 1024) || 0);

  const res = await apiCall('/api/books', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${authToken}` },
    body: JSON.stringify(Object.fromEntries(formData))
  });

  if (res && res.success) {
    showMessage('booksMessage', 'Book uploaded successfully', 'success');
    closeBookModal();
    loadBooks();
  } else {
    showMessage('booksMessage', res?.message || 'Error uploading book', 'error');
  }
});

function closeBookModal() {
  document.getElementById('bookModal').classList.remove('active');
}

// Categories management
async function loadCategories() {
  try {
    const res = await apiCall('/api/categories');
    if (!res || !res.success) return;

    const tbody = document.getElementById('categoriesBody');
    tbody.innerHTML = res.data.map(cat => `
      <tr>
        <td>${cat.GenreName}</td>
        <td>${cat.Description || '-'}</td>
        <td>${cat.BookCount}</td>
        <td>
          ${currentUser.role === 'Admin' ? `
            <button class="btn secondary" onclick="editCategory(${cat.CategoryID})">Edit</button>
          ` : ''}
        </td>
      </tr>
    `).join('');

    // Populate category select in book form
    const select = document.getElementById('bookCategory');
    select.innerHTML = res.data.map(cat => `<option value="${cat.CategoryID}">${cat.GenreName}</option>`).join('');
  } catch (error) {
    console.error('Error loading categories:', error);
  }
}

document.getElementById('addCategoryBtn').addEventListener('click', () => {
  document.getElementById('categoryModal').classList.add('active');
  document.getElementById('categoryForm').reset();
});

document.getElementById('categoryForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const data = {
    genreName: document.getElementById('categoryName').value,
    description: document.getElementById('categoryDescription').value
  };

  const res = await apiCall('/api/categories', {
    method: 'POST',
    body: JSON.stringify(data)
  });

  if (res && res.success) {
    showMessage('categoriesMessage', 'Category created', 'success');
    closeCategoryModal();
    loadCategories();
  } else {
    showMessage('categoriesMessage', 'Error creating category', 'error');
  }
});

function closeCategoryModal() {
  document.getElementById('categoryModal').classList.remove('active');
}

// Utility functions
function showMessage(elementId, message, type) {
  const element = document.getElementById(elementId);
  element.textContent = message;
  element.className = `message ${type}`;
  element.style.display = 'block';
  
  setTimeout(() => {
    element.style.display = 'none';
  }, 5000);
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/index.html';
}
