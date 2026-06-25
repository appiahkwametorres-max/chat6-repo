const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const JWT_SECRET = process.env.JWT_SECRET || 'chat6_secret_key_2024';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'chat6_admin_secret';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================
// DATABASE SETUP
// ============================
const db = new sqlite3.Database(path.join(__dirname, 'database', 'chat6.db'));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone_number TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    password TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    status TEXT DEFAULT 'offline',
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS ads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT,
    image_url TEXT,
    link TEXT,
    position TEXT DEFAULT 'chat_top',
    active INTEGER DEFAULT 1,
    clicks INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS ad_clicks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ad_id INTEGER,
    user_id INTEGER,
    clicked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ad_id) REFERENCES ads(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // Create default admin
  db.get("SELECT * FROM users WHERE is_admin = 1", (err, row) => {
    if (!row) {
      const adminPass = bcrypt.hashSync('admin123', 10);
      db.run(
        "INSERT INTO users (phone_number, display_name, password, is_admin) VALUES (?, ?, ?, ?)",
        ['+1000000000', 'Administrator', adminPass, 1]
      );
    }
  });
});

// ============================
// MIDDLEWARE
// ============================
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(403).json({ error: 'Invalid token' });
  }
};

const isAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// ============================
// AUTH ROUTES
// ============================
app.post('/api/auth/register', (req, res) => {
  const { phone_number, display_name, password, otp_code } = req.body;
  if (!phone_number || !display_name || !password) {
    return res.status(400).json({ error: 'All fields required' });
  }

  const hashed = bcrypt.hashSync(password, 10);
  db.run(
    'INSERT INTO users (phone_number, display_name, password) VALUES (?, ?, ?)',
    [phone_number, display_name, hashed],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Phone number already registered' });
        return res.status(500).json({ error: err.message });
      }
      const token = jwt.sign({ id: this.lastID, phone: phone_number, isAdmin: 0 }, JWT_SECRET);
      res.json({ success: true, token, user: { id: this.lastID, phone_number, display_name } });
    }
  );
});

app.post('/api/auth/login', (req, res) => {
  const { phone_number, password } = req.body;
  if (!phone_number || !password) return res.status(400).json({ error: 'Missing fields' });

  db.get('SELECT * FROM users WHERE phone_number = ?', [phone_number], (err, user) => {
    if (err || !user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid phone number or password' });
    }
    const token = jwt.sign({ id: user.id, phone: user.phone_number, isAdmin: user.is_admin }, JWT_SECRET);
    res.json({ success: true, token, user: { id: user.id, phone_number: user.phone_number, display_name: user.display_name, is_admin: user.is_admin } });
  });
});

app.post('/api/auth/verify-phone', (req, res) => {
  const { phone_number } = req.body;
  if (!phone_number) return res.status(400).json({ error: 'Phone number required' });

  // Check if already registered
  db.get('SELECT id FROM users WHERE phone_number = ?', [phone_number], (err, row) => {
    if (row) return res.status(400).json({ error: 'Phone already registered' });
    // Generate OTP (simulated - in production, send via SMS)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    res.json({ success: true, otp, message: 'Use this code to verify (SMS simulation)' });
  });
});

app.get('/api/auth/me', authenticate, (req, res) => {
  db.get('SELECT id, phone_number, display_name, is_admin, status FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  });
});

// ============================
// USER ROUTES
// ============================
app.get('/api/users', authenticate, (req, res) => {
  db.all('SELECT id, phone_number, display_name, status, last_seen FROM users WHERE id != ?', [req.user.id], (err, users) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(users);
  });
});

app.get('/api/users/search', authenticate, (req, res) => {
  const q = req.query.q || '';
  db.all(
    'SELECT id, phone_number, display_name, status FROM users WHERE id != ? AND (phone_number LIKE ? OR display_name LIKE ?)',
    [req.user.id, `%${q}%`, `%${q}%`],
    (err, users) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(users);
    }
  );
});

// ============================
// MESSAGE ROUTES
// ============================
app.get('/api/messages/:userId', authenticate, (req, res) => {
  const otherId = req.params.userId;
  const myId = req.user.id;

  db.all(
    `SELECT m.*, u.display_name as sender_name, u.phone_number as sender_phone
     FROM messages m
     JOIN users u ON m.sender_id = u.id
     WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
     ORDER BY m.created_at ASC`,
    [myId, otherId, otherId, myId],
    (err, messages) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(messages);
    }
  );
});

app.post('/api/messages/:userId/read', authenticate, (req, res) => {
  const senderId = req.params.userId;
  db.run(
    'UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ?',
    [senderId, req.user.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

// ============================
// ADMIN ROUTES
// ============================
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    const token = jwt.sign({ admin: true }, ADMIN_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token });
  } else {
    res.status(401).json({ error: 'Invalid admin credentials' });
  }
});

app.get('/api/admin/stats', authenticate, isAdmin, (req, res) => {
  db.get('SELECT COUNT(*) as total_users FROM users', (err, u) => {
    if (err) return res.status(500).json({ error: err.message });
    db.get('SELECT COUNT(*) as total_messages FROM messages', (err, m) => {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT COUNT(*) as active_ads FROM ads WHERE active = 1', (err, a) => {
        if (err) return res.status(500).json({ error: err.message });
        db.get('SELECT COUNT(*) as total_clicks FROM ad_clicks', (err, c) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({
            total_users: u.total_users,
            total_messages: m.total_messages,
            active_ads: a.active_ads,
            total_clicks: c.total_clicks
          });
        });
      });
    });
  });
});

app.get('/api/admin/users', authenticate, isAdmin, (req, res) => {
  db.all('SELECT id, phone_number, display_name, is_admin, status, created_at FROM users ORDER BY created_at DESC', (err, users) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(users);
  });
});

app.delete('/api/admin/users/:id', authenticate, isAdmin, (req, res) => {
  const userId = req.params.id;
  db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, deleted: this.changes });
  });
});

app.get('/api/admin/messages', authenticate, isAdmin, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  db.all(
    `SELECT m.*, s.display_name as sender_name, r.display_name as receiver_name
     FROM messages m
     JOIN users s ON m.sender_id = s.id
     JOIN users r ON m.receiver_id = r.id
     ORDER BY m.created_at DESC LIMIT ?`,
    [limit],
    (err, messages) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(messages);
    }
  );
});

// ============================
// ADS ROUTES
// ============================
app.get('/api/ads', authenticate, (req, res) => {
  const position = req.query.position || 'chat_top';
  db.all('SELECT * FROM ads WHERE position = ? AND active = 1 ORDER BY created_at DESC', [position], (err, ads) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(ads);
  });
});

app.get('/api/admin/ads', authenticate, isAdmin, (req, res) => {
  db.all('SELECT * FROM ads ORDER BY created_at DESC', (err, ads) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(ads);
  });
});

app.post('/api/admin/ads', authenticate, isAdmin, (req, res) => {
  const { title, content, image_url, link, position } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });

  db.run(
    'INSERT INTO ads (title, content, image_url, link, position) VALUES (?, ?, ?, ?, ?)',
    [title, content || '', image_url || '', link || '', position || 'chat_top'],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    }
  );
});

app.put('/api/admin/ads/:id', authenticate, isAdmin, (req, res) => {
  const { title, content, image_url, link, position, active } = req.body;
  db.run(
    'UPDATE ads SET title = ?, content = ?, image_url = ?, link = ?, position = ?, active = ? WHERE id = ?',
    [title, content, image_url, link, position, active ? 1 : 0, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, updated: this.changes });
    }
  );
});

app.delete('/api/admin/ads/:id', authenticate, isAdmin, (req, res) => {
  db.run('DELETE FROM ads WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, deleted: this.changes });
  });
});

app.post('/api/ads/:id/click', authenticate, (req, res) => {
  db.run('INSERT INTO ad_clicks (ad_id, user_id) VALUES (?, ?)', [req.params.id, req.user.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    db.run('UPDATE ads SET clicks = clicks + 1 WHERE id = ?', [req.params.id], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ success: true });
    });
  });
});

// ============================
// SOCKET.IO REAL-TIME CHAT
// ============================
const onlineUsers = new Map();

io.on('connection', (socket) => {
  let currentUser = null;

  socket.on('authenticate', (token) => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      currentUser = decoded;
      onlineUsers.set(decoded.id, { socketId: socket.id, phone: decoded.phone });

      db.run('UPDATE users SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?', ['online', decoded.id]);
      socket.broadcast.emit('user_online', { userId: decoded.id });
    } catch (err) {
      console.log('Socket auth failed');
    }
  });

  socket.on('send_message', (data) => {
    if (!currentUser) return;
    const { receiverId, content, messageType } = data;
    if (!content || !receiverId) return;

    const type = messageType || 'text';
    db.run(
      'INSERT INTO messages (sender_id, receiver_id, content, message_type) VALUES (?, ?, ?, ?)',
      [currentUser.id, receiverId, content, type],
      function(err) {
        if (err) return;
        const message = {
          id: this.lastID,
          sender_id: currentUser.id,
          receiver_id: parseInt(receiverId),
          content,
          message_type: type,
          sender_name: currentUser.phone,
          created_at: new Date().toISOString()
        };
        socket.emit('message_sent', message);
        const receiver = onlineUsers.get(parseInt(receiverId));
        if (receiver) {
          io.to(receiver.socketId).emit('new_message', message);
        }
      }
    );
  });

  socket.on('typing', (data) => {
    if (!currentUser) return;
    const receiver = onlineUsers.get(parseInt(data.receiverId));
    if (receiver) {
      io.to(receiver.socketId).emit('typing', { userId: currentUser.id });
    }
  });

  socket.on('stop_typing', (data) => {
    if (!currentUser) return;
    const receiver = onlineUsers.get(parseInt(data.receiverId));
    if (receiver) {
      io.to(receiver.socketId).emit('stop_typing', { userId: currentUser.id });
    }
  });

  socket.on('disconnect', () => {
    if (currentUser) {
      db.run('UPDATE users SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?', ['offline', currentUser.id]);
      onlineUsers.delete(currentUser.id);
      socket.broadcast.emit('user_offline', { userId: currentUser.id });
    }
  });
});

// ============================
// SERVE HTML PAGES
// ============================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/chat', (req, res) => res.sendFile(path.join(__dirname, 'public', 'chat.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));

// ============================
// START SERVER
// ============================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Chat6 server running on port ${PORT}`);
  console.log(`App URL: http://localhost:${PORT}`);
  console.log(`Admin URL: http://localhost:${PORT}/admin`);
});
