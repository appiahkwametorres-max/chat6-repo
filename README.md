# Chat6 - Web Messenger Platform

A full-featured, web-based real-time chat messenger with phone number authentication, admin dashboard, and advertisement management system.

## Features

### User Features
- **Phone Number Authentication** — Register and login with your phone number (OTP verification flow)
- **Real-time Messaging** — Instant message delivery via WebSockets (Socket.io)
- **Online/Offline Status** — See when contacts are online with live indicators
- **Typing Indicators** — Know when someone is typing
- **Message History** — All conversations persist in SQLite database
- **Contact Search** — Find users by phone number or name
- **Mobile-First Design** — Works like a native app on any smartphone

### Admin Features
- **Full Dashboard** — View total users, messages, active ads, and ad clicks
- **User Management** — View all registered users, delete accounts
- **Message Monitoring** — View all platform messages for moderation
- **Advertisement Panel** — Create, edit, delete, and toggle ads
- **Ad Performance Tracking** — Track clicks and impressions
- **Admin Authentication** — Separate secure admin login

## Quick Start (Local)

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# 3. Open browser
http://localhost:3000

# Default Admin:
# Username: admin
# Password: admin123
```

## Deploy to Render.com (Free Permanent URL)

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Chat6 messenger"
   # Create repo on GitHub and push
   ```

2. **Create Web Service on [Render.com](https://render.com)**
   - Sign up (free, no credit card required)
   - Click **"New +"** → **"Web Service"**
   - Connect your GitHub repository

3. **Configure Settings**
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free

4. **Deploy**
   - Render will build and give you a permanent URL like `https://chat6-xxx.onrender.com`

## Project Structure

```
chat6/
├── server.js                  # Main Express + Socket.io server
├── package.json               # Dependencies
├── .env                       # Environment variables (change secrets!)
├── database/
│   └── chat6.db               # SQLite database (auto-created)
└── public/
    ├── index.html             # Landing page
    ├── register.html          # Registration (phone + OTP)
    ├── login.html             # Login page
    ├── chat.html              # Main chat interface
    ├── admin.html             # Admin dashboard
    ├── css/
    │   ├── style.css          # App styles (dark theme)
    │   └── admin.css          # Admin panel styles
    └── js/
        ├── auth.js            # Auth logic (login/register)
        ├── chat.js            # Chat interface logic
        └── admin.js           # Admin panel logic
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js, Express |
| Real-time | Socket.io |
| Database | SQLite3 |
| Auth | JWT tokens + bcryptjs |
| Frontend | Vanilla HTML/CSS/JS (no build step) |

## Admin Panel

Access `/admin` to reach the admin dashboard.

**Default Credentials:**
- Username: `admin`
- Password: `admin123`

**Important:** Change the default admin password in production by logging in to admin panel or updating the database.

## Advertisement System

The admin can create ads that appear in:
- **Chat Top Banner** — Displayed above chat messages
- **Sidebar** — Can be extended for sidebar placement

Each ad tracks:
- Title, content, image URL, link
- Click count
- Active/Inactive status

## Security Notes

1. Change `JWT_SECRET` and `ADMIN_SECRET` in `.env` before deploying
2. Change default admin password immediately after first login
3. For production, consider using a real SMS service (Twilio) instead of the simulated OTP
4. Use HTTPS in production (Render provides this automatically)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | JWT signing key | random string |
| `ADMIN_SECRET` | Admin session key | random string |
| `PORT` | Server port | 3000 |

## Screenshots (Expected)

- **Landing Page:** Branded welcome with Get Started / Login buttons
- **Register:** Phone number entry, simulated OTP display, password setup
- **Login:** Phone number + password fields
- **Chat:** Dark-themed sidebar with contacts, message area with ads, typing indicators
- **Admin:** Dashboard with stats cards, user tables, message logs, ad management modal

## Full Control

You own 100% of the code. Customize:
- Colors in `css/style.css` and `css/admin.css`
- Features in `server.js` (add group chats, file sharing, etc.)
- UI in any `.html` file
- Add real SMS by replacing the simulated OTP function

## License

MIT — Free to use, modify, and deploy.
