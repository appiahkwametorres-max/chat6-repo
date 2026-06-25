let adminToken = localStorage.getItem('adminToken');
let currentTab = 'dashboard';
let editingAdId = null;

function initAdmin() {
  if (!adminToken) {
    document.getElementById('admin-login').classList.remove('hidden');
    document.getElementById('tab-dashboard').classList.add('hidden');
    return;
  }
  document.getElementById('admin-login').classList.add('hidden');
  showTab('dashboard');
}

async function adminLogin() {
  const user = document.getElementById('admin-user').value;
  const pass = document.getElementById('admin-pass').value;
  
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, password: pass })
    });
    
    const data = await res.json();
    if (data.success) {
      adminToken = data.token;
      localStorage.setItem('adminToken', adminToken);
      document.getElementById('admin-login').classList.add('hidden');
      showTab('dashboard');
    } else {
      alert(data.error || 'Login failed');
    }
  } catch (err) {
    alert('Network error');
  }
}

function logoutAdmin() {
  adminToken = null;
  localStorage.removeItem('adminToken');
  window.location.reload();
}

function showTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
  document.getElementById(`tab-${tab}`).classList.remove('hidden');
  document.querySelectorAll('.admin-nav li').forEach(li => li.classList.remove('active'));
  event.target.closest('li').classList.add('active');
  document.getElementById('page-title').textContent = tab.charAt(0).toUpperCase() + tab.slice(1);
  
  if (tab === 'dashboard') loadStats();
  if (tab === 'users') loadUsers();
  if (tab === 'messages') loadMessages();
  if (tab === 'ads') loadAds();
}

async function loadStats() {
  try {
    const res = await fetch('/api/admin/stats', { headers: { 'Authorization': `Bearer ${adminToken}` } });
    if (!res.ok) { if (res.status === 401) logoutAdmin(); return; }
    const stats = await res.json();
    document.getElementById('stat-users').textContent = stats.total_users;
    document.getElementById('stat-messages').textContent = stats.total_messages;
    document.getElementById('stat-ads').textContent = stats.active_ads;
    document.getElementById('stat-clicks').textContent = stats.total_clicks;
  } catch (err) { console.error(err); }
}

async function loadUsers() {
  try {
    const res = await fetch('/api/admin/users', { headers: { 'Authorization': `Bearer ${adminToken}` } });
    if (!res.ok) return;
    const users = await res.json();
    const tbody = document.querySelector('#users-table tbody');
    tbody.innerHTML = '';
    users.forEach(u => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${u.id}</td>
        <td>${escapeHtml(u.phone_number)}</td>
        <td>${escapeHtml(u.display_name)}</td>
        <td><span class="status-badge ${u.status}">${u.status}</span></td>
        <td>${new Date(u.created_at).toLocaleDateString()}</td>
        <td>
          <button class="btn-small btn-delete" onclick="deleteUser(${u.id})">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) { console.error(err); }
}

async function deleteUser(id) {
  if (!confirm('Delete this user?')) return;
  try {
    const res = await fetch(`/api/admin/users/${id}`, { 
      method: 'DELETE', 
      headers: { 'Authorization': `Bearer ${adminToken}` } 
    });
    if (res.ok) loadUsers();
  } catch (err) { console.error(err); }
}

async function loadMessages() {
  try {
    const res = await fetch('/api/admin/messages', { headers: { 'Authorization': `Bearer ${adminToken}` } });
    if (!res.ok) return;
    const msgs = await res.json();
    const tbody = document.querySelector('#messages-table tbody');
    tbody.innerHTML = '';
    msgs.forEach(m => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${m.id}</td>
        <td>${escapeHtml(m.sender_name)}</td>
        <td>${escapeHtml(m.receiver_name)}</td>
        <td>${escapeHtml(m.content.substring(0, 50))}${m.content.length > 50 ? '...' : ''}</td>
        <td>${new Date(m.created_at).toLocaleString()}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) { console.error(err); }
}

async function loadAds() {
  try {
    const res = await fetch('/api/admin/ads', { headers: { 'Authorization': `Bearer ${adminToken}` } });
    if (!res.ok) return;
    const ads = await res.json();
    const tbody = document.querySelector('#ads-table tbody');
    tbody.innerHTML = '';
    ads.forEach(ad => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${ad.id}</td>
        <td>${escapeHtml(ad.title)}</td>
        <td>${ad.position}</td>
        <td>${ad.clicks}</td>
        <td><span class="status-badge ${ad.active ? 'active' : 'inactive'}">${ad.active ? 'Active' : 'Inactive'}</span></td>
        <td>
          <button class="btn-small btn-edit" onclick="editAd(${ad.id})">Edit</button>
          <button class="btn-small btn-delete" onclick="deleteAd(${ad.id})">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) { console.error(err); }
}

async function editAd(id) {
  try {
    const res = await fetch('/api/admin/ads', { headers: { 'Authorization': `Bearer ${adminToken}` } });
    if (!res.ok) return;
    const ads = await res.json();
    const ad = ads.find(a => a.id === id);
    if (!ad) return;
    
    editingAdId = id;
    document.getElementById('modal-title').textContent = 'Edit Advertisement';
    document.getElementById('ad-title').value = ad.title;
    document.getElementById('ad-content').value = ad.content || '';
    document.getElementById('ad-image').value = ad.image_url || '';
    document.getElementById('ad-link').value = ad.link || '';
    document.getElementById('ad-position').value = ad.position || 'chat_top';
    document.getElementById('ad-active').checked = ad.active === 1;
    document.getElementById('ad-modal').classList.remove('hidden');
  } catch (err) { console.error(err); }
}

function openAdModal() {
  editingAdId = null;
  document.getElementById('modal-title').textContent = 'Create Advertisement';
  document.getElementById('ad-title').value = '';
  document.getElementById('ad-content').value = '';
  document.getElementById('ad-image').value = '';
  document.getElementById('ad-link').value = '';
  document.getElementById('ad-position').value = 'chat_top';
  document.getElementById('ad-active').checked = true;
  document.getElementById('ad-modal').classList.remove('hidden');
}

function closeAdModal() {
  document.getElementById('ad-modal').classList.add('hidden');
  editingAdId = null;
}

async function saveAd() {
  const body = {
    title: document.getElementById('ad-title').value,
    content: document.getElementById('ad-content').value,
    image_url: document.getElementById('ad-image').value,
    link: document.getElementById('ad-link').value,
    position: document.getElementById('ad-position').value,
    active: document.getElementById('ad-active').checked ? 1 : 0
  };
  
  try {
    let res;
    if (editingAdId) {
      res = await fetch(`/api/admin/ads/${editingAdId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify(body)
      });
    } else {
      res = await fetch('/api/admin/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify(body)
      });
    }
    
    if (res.ok) {
      closeAdModal();
      loadAds();
    } else {
      alert('Failed to save ad');
    }
  } catch (err) { alert('Error'); }
}

async function deleteAd(id) {
  if (!confirm('Delete this ad?')) return;
  try {
    const res = await fetch(`/api/admin/ads/${id}`, { 
      method: 'DELETE', 
      headers: { 'Authorization': `Bearer ${adminToken}` } 
    });
    if (res.ok) loadAds();
  } catch (err) { console.error(err); }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

initAdmin();
