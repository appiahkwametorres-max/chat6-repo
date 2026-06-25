let socket = null;
let currentUser = null;
let currentChat = null;
let token = localStorage.getItem('token');
let allUsers = [];

const userStr = localStorage.getItem('user');
if (userStr) {
  try { currentUser = JSON.parse(userStr); } catch (e) { clearSession(); }
}

if (!token || !currentUser) {
  window.location.href = '/login';
}

function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  token = null; currentUser = null;
}

function init() {
  if (!currentUser) return;
  document.getElementById('user-name').textContent = currentUser.display_name || currentUser.phone_number;
  document.getElementById('user-avatar').textContent = (currentUser.display_name || 'U')[0].toUpperCase();
  loadUsers();
  connectSocket();
  loadAds();
}

async function loadUsers() {
  try {
    const res = await fetch('/api/users', { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) throw new Error('Failed');
    allUsers = await res.json();
    renderContacts(allUsers);
  } catch (err) {
    console.error(err);
    document.getElementById('contacts-list').innerHTML = '<div class="loading">Error loading contacts</div>';
  }
}

function renderContacts(users) {
  const list = document.getElementById('contacts-list');
  list.innerHTML = '';
  if (users.length === 0) {
    list.innerHTML = '<div class="loading">No contacts found</div>';
    return;
  }
  users.forEach(u => {
    const div = document.createElement('div');
    div.className = 'contact-item';
    div.dataset.id = u.id;
    div.onclick = () => openChat(u);
    div.innerHTML = `
      <div class="avatar">${(u.display_name || u.phone_number)[0].toUpperCase()}</div>
      <div class="contact-info">
        <div class="contact-name">${escapeHtml(u.display_name || u.phone_number)}</div>
        <div class="contact-meta">${u.phone_number}</div>
      </div>
      <div class="contact-status-dot ${u.status === 'online' ? 'online' : ''}" id="status-dot-${u.id}"></div>
    `;
    list.appendChild(div);
  });
}

function searchUsers() {
  const q = document.getElementById('search-users').value.trim().toLowerCase();
  if (!q) { renderContacts(allUsers); return; }
  const filtered = allUsers.filter(u => 
    (u.display_name || '').toLowerCase().includes(q) || 
    u.phone_number.includes(q)
  );
  renderContacts(filtered);
}

async function openChat(user) {
  currentChat = user;
  document.querySelectorAll('.contact-item').forEach(el => el.classList.remove('active'));
  const el = document.querySelector(`.contact-item[data-id="${user.id}"]`);
  if (el) el.classList.add('active');

  document.getElementById('chat-placeholder').classList.add('hidden');
  document.getElementById('chat-view').classList.remove('hidden');
  document.getElementById('contact-name').textContent = user.display_name || user.phone_number;
  document.getElementById('contact-avatar').textContent = (user.display_name || user.phone_number)[0].toUpperCase();
  document.getElementById('contact-status').textContent = user.status === 'online' ? 'online' : 'offline';
  
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.add('chat-open');
  }
  
  await loadMessages(user.id);
  markRead(user.id);
}

function closeChat() {
  currentChat = null;
  document.getElementById('chat-view').classList.add('hidden');
  document.getElementById('chat-placeholder').classList.remove('hidden');
  document.querySelectorAll('.contact-item').forEach(el => el.classList.remove('active'));
  document.getElementById('sidebar').classList.remove('chat-open');
}

async function loadMessages(userId) {
  try {
    const res = await fetch(`/api/messages/${userId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) throw new Error('Failed');
    const msgs = await res.json();
    const container = document.getElementById('messages-area');
    container.innerHTML = '';
    if (msgs.length === 0) {
      container.innerHTML = '<div class="loading" style="text-align:center;padding:40px">No messages yet. Say hello!</div>';
    } else {
      msgs.forEach(m => appendMessage(m, false));
    }
    scrollToBottom();
  } catch (err) { console.error(err); }
}

function appendMessage(msg, animate = true) {
  const container = document.getElementById('messages-area');
  const empty = container.querySelector('.loading');
  if (empty) empty.remove();
  
  const div = document.createElement('div');
  const isSent = msg.sender_id === (currentUser?.id);
  div.className = `message ${isSent ? 'sent' : 'received'}`;
  if (animate) div.style.animation = 'msgSlide 0.25s ease-out';
  
  const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  div.innerHTML = `${escapeHtml(msg.content)}<div class="message-time">${time}</div>`;
  container.appendChild(div);
  scrollToBottom();
}

function scrollToBottom() {
  const area = document.getElementById('messages-area');
  area.scrollTop = area.scrollHeight;
}

function markRead(senderId) {
  fetch(`/api/messages/${senderId}/read`, { 
    method: 'POST', 
    headers: { 'Authorization': `Bearer ${token}` } 
  }).catch(() => {});
}

async function sendMessage() {
  const input = document.getElementById('message-input');
  const content = input.value.trim();
  if (!content || !currentChat) return;
  if (!socket) { alert('Not connected'); return; }
  
  socket.emit('send_message', { receiverId: currentChat.id, content, messageType: 'text' });
  input.value = '';
}

function connectSocket() {
  if (socket) return;
  socket = io();
  
  socket.on('connect', () => {
    socket.emit('authenticate', token);
  });
  
  socket.on('message_sent', (msg) => {
    if (currentChat && msg.receiver_id === currentChat.id) {
      appendMessage(msg);
    }
  });
  
  socket.on('new_message', (msg) => {
    if (currentChat && msg.sender_id === currentChat.id) {
      appendMessage(msg);
      markRead(msg.sender_id);
    }
  });
  
  socket.on('user_online', ({ userId }) => {
    const dot = document.getElementById(`status-dot-${userId}`);
    if (dot) dot.classList.add('online');
    if (currentChat && currentChat.id === userId) {
      document.getElementById('contact-status').textContent = 'online';
    }
  });
  
  socket.on('user_offline', ({ userId }) => {
    const dot = document.getElementById(`status-dot-${userId}`);
    if (dot) dot.classList.remove('online');
    if (currentChat && currentChat.id === userId) {
      document.getElementById('contact-status').textContent = 'offline';
    }
  });
  
  socket.on('typing', ({ userId }) => {
    if (currentChat && currentChat.id === userId) {
      document.getElementById('typing-indicator').classList.remove('hidden');
    }
  });
  
  socket.on('stop_typing', ({ userId }) => {
    if (currentChat && currentChat.id === userId) {
      document.getElementById('typing-indicator').classList.add('hidden');
    }
  });
}

// Typing indicator
let typingTimeout;
document.getElementById('message-input').addEventListener('input', () => {
  if (!socket || !currentChat) return;
  socket.emit('typing', { receiverId: currentChat.id });
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('stop_typing', { receiverId: currentChat.id });
  }, 1500);
});

document.getElementById('message-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

// Ads
async function loadAds() {
  try {
    const res = await fetch('/api/ads?position=chat_top', { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) return;
    const ads = await res.json();
    if (ads.length > 0) {
      const banner = document.getElementById('ad-banner');
      const ad = ads[0];
      banner.innerHTML = `
        <div class="ad-item" onclick="clickAd(${ad.id}, '${ad.link}')">
          ${ad.image_url ? `<img src="${escapeHtml(ad.image_url)}" alt="">` : ''}
          <div class="ad-text">
            <div class="ad-title">${escapeHtml(ad.title)}</div>
            ${ad.content ? `<div class="ad-desc">${escapeHtml(ad.content)}</div>` : ''}
          </div>
          <span class="ad-badge">Ad</span>
        </div>
      `;
    }
  } catch (err) { console.error(err); }
}

async function clickAd(adId, link) {
  try {
    await fetch(`/api/ads/${adId}/click`, { 
      method: 'POST', 
      headers: { 'Authorization': `Bearer ${token}` } 
    });
  } catch (e) {}
  if (link) window.open(link, '_blank');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function logout() {
  if (socket) socket.disconnect();
  clearSession();
  window.location.href = '/login';
}

init();
