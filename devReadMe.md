# Bella Vista POS — Developer Guide

Full-stack, multi-tenant Point-of-Sale system built with **React 19 + Vite** on the frontend and **Node.js + Express 5 + PostgreSQL 16** on the backend.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Prerequisites](#prerequisites)
4. [Environment Setup](#environment-setup)
5. [Running in Development Mode](#running-in-development-mode)
6. [Database Setup](#database-setup)
7. [Default Accounts](#default-accounts)
8. [API Overview](#api-overview)
9. [Deployment](#deployment)
10. [Environment Variables Reference](#environment-variables-reference)

---

## Tech Stack

### Frontend (`client/`)
| Tool | Version | Purpose |
|------|---------|---------|
| React | 19 | UI framework |
| React Router DOM | 7 | Client-side routing |
| Vite | 8 | Build tool & dev server |
| Tailwind CSS | 4 | Utility-first styling |
| Recharts | 3 | Analytics charts |
| Socket.IO Client | 4 | Real-time updates |
| Lucide React | latest | Icon library |
| qrcode.react | 4 | QR code generation (table ordering) |
| clsx | 2 | Conditional classNames |

### Backend (`server/`)
| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | ≥ 20 | Runtime |
| Express | 5 | HTTP framework |
| PostgreSQL | 16 | Primary database |
| pg | 8 | PostgreSQL driver (connection pool) |
| jsonwebtoken | 9 | JWT access + refresh tokens |
| bcryptjs | 3 | Password hashing |
| Socket.IO | 4 | WebSocket server |
| Nodemailer | 8 | Email (password reset, SMTP) |
| express-validator | 7 | Request validation |
| Helmet | 8 | HTTP security headers |
| Morgan | 1 | HTTP request logging |
| dotenv | 17 | Environment variable loading |
| nodemon | 3 | Auto-reload in development |

---

## Project Structure

```
PosSystem/
├── client/                     # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── charts/         # Recharts chart components
│   │   │   ├── layout/         # Sidebar, Layout wrapper
│   │   │   ├── tables/         # TableCard, QRCodeModal
│   │   │   └── ui/             # Button, Modal, Input, Badge, Select…
│   │   ├── context/            # AuthContext, AppContext, SettingsContext
│   │   ├── i18n/               # Translation strings (en/fr/ar)
│   │   ├── pages/              # One file per route
│   │   │   └── superadmin/     # SuperAdmin-only pages
│   │   ├── services/
│   │   │   ├── api.js          # All fetch wrappers (authApi, ordersApi…)
│   │   │   └── socket.js       # Socket.IO client
│   │   ├── utils/              # formatters, tableHelpers…
│   │   ├── App.jsx             # Routes
│   │   ├── main.jsx            # ReactDOM entry point
│   │   └── index.css           # Tailwind + global CSS
│   ├── vite.config.js          # Dev server + proxy config
│   └── package.json
│
├── server/                     # Express backend
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js           # pg Pool + query helper
│   │   │   └── socket.js       # Socket.IO server init
│   │   ├── controllers/        # Business logic (one file per resource)
│   │   ├── middleware/
│   │   │   ├── auth.js         # JWT verification (verifyToken)
│   │   │   ├── authorize.js    # Role-based access (requireRole)
│   │   │   └── restaurantScope.js  # Multi-tenancy scoping
│   │   ├── routes/             # Express routers (one file per resource)
│   │   └── app.js              # Express app + all routes wired up
│   ├── database/
│   │   ├── posdb.sql           # Complete schema (31 tables, indexes, triggers)
│   │   └── seed.js             # Schema setup + SuperAdmin + test data
│   ├── server.js               # Entry point (HTTP server + Socket.IO)
│   ├── .env                    # Your local env vars (never commit)
│   ├── .env.example            # Template — copy this to .env
│   └── package.json
│
└── docker-compose.yml          # PostgreSQL container only
```

---

## Prerequisites

Install these before anything else.

| Requirement | Minimum Version | Download |
|-------------|----------------|---------|
| Node.js | 20 LTS | https://nodejs.org |
| npm | 10+ (bundled with Node 20) | — |
| PostgreSQL | 16 | https://www.postgresql.org/download/ |
| Git | any | https://git-scm.com |

> **Tip — PostgreSQL via Docker (recommended for dev):**
> If you don't want to install PostgreSQL locally, the included `docker-compose.yml` spins up a pre-configured container. See [Database Setup](#database-setup).

Verify your installs:
```bash
node  --version   # v20.x.x or higher
npm   --version   # 10.x.x or higher
psql  --version   # psql (PostgreSQL) 16.x
```

---

## Environment Setup

### 1. Clone the repository

```bash
git clone <repo-url>
cd PosSystem
```

### 2. Install dependencies

Run these two commands **in parallel** (separate terminals) or sequentially:

```bash
# Terminal A — frontend
cd client
npm install

# Terminal B — backend
cd server
npm install
```

### 3. Create the server environment file

```bash
cd server
cp .env.example .env
```

Then open `server/.env` and fill in your values:

```env
PORT=3001
NODE_ENV=development

# ─── PostgreSQL ───────────────────────────────────────────────────────────────
DB_HOST=127.0.0.1
DB_PORT=5432          # 5433 if using the Docker container
DB_USER=posuser
DB_PASSWORD=pospassword
DB_NAME=posdb

# ─── JWT (change both secrets — minimum 32 characters each) ──────────────────
JWT_SECRET=change_me_at_least_32_characters_long
JWT_EXPIRES_IN=8h
JWT_REFRESH_SECRET=another_different_secret_also_32_chars
JWT_REFRESH_EXPIRES_IN=7d

# ─── CORS ─────────────────────────────────────────────────────────────────────
CLIENT_ORIGIN=http://localhost:5173

# ─── Tax rate ─────────────────────────────────────────────────────────────────
TAX_RATE=0.10

# ─── Email / SMTP (optional in dev — auto-creates Ethereal test account) ──────
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
EMAIL_FROM_NAME=POS System
EMAIL_FROM_ADDRESS=noreply@pos.system

# ─── Frontend base URL (used in password reset emails) ───────────────────────
APP_URL=http://localhost:5173
```

> **Note:** The `client/` directory has no `.env` file. Frontend config (API proxy, port) lives entirely in `client/vite.config.js`.

---

## Running in Development Mode

You need **two terminals** running simultaneously — one for the backend, one for the frontend.

### Terminal 1 — Backend

```bash
cd server
npm run dev
```

**Expected output:**
```
[nodemon] starting `node server.js`
✅ PostgreSQL connected — 2026-01-15T10:00:00.000Z

🚀  POS API running on http://localhost:3001
   Health:  http://localhost:3001/health
   Socket:  ws://localhost:3001  (room: "pos")
```

> If PostgreSQL isn't running you'll see `❌ PostgreSQL connection failed` and the process exits. Start PostgreSQL first (see [Database Setup](#database-setup)).

### Terminal 2 — Frontend

```bash
cd client
npm run dev
```

**Expected output:**
```
  VITE v8.x.x  ready in 300ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.x.x:5173/
```

### Open in browser

```
http://localhost:5173
```

Vite proxies all `/api/*` and `/socket.io` requests to `http://localhost:3001` automatically — no manual CORS configuration needed in dev.

### Development workflow

| What changed | What to do |
|-------------|-----------|
| Frontend `.jsx` / `.css` | Nothing — Vite HMR reloads instantly |
| Backend route/controller | Nothing — nodemon restarts automatically |
| `server/.env` | Restart the backend terminal (`Ctrl+C` → `npm run dev`) |
| Database schema | Re-run `npm run setup` (drops & recreates data) |

---

## Database Setup

### Option A — Docker (recommended for dev)

The `docker-compose.yml` at the project root runs a PostgreSQL 16 container with the database pre-created.

```bash
# From project root (PosSystem/)
docker compose up -d
```

This starts `pos-postgres` on port **5433**. Update `server/.env`:

```env
DB_HOST=127.0.0.1
DB_PORT=5433
DB_USER=postgres
DB_PASSWORD=postgres_password_123
DB_NAME=posdb
```

Then run the setup script (see below).

### Option B — Local PostgreSQL

#### Step 1 — Create database and user

```bash
# Connect as the postgres superuser
psql -U postgres

-- Inside psql:
CREATE USER posuser WITH PASSWORD 'pospassword';
CREATE DATABASE posdb OWNER posuser;
GRANT ALL PRIVILEGES ON DATABASE posdb TO posuser;
\q
```

#### Step 2 — Apply schema + seed test data

Run from the `server/` directory:

```bash
cd server
npm run setup
```

This executes `database/seed.js --setup` which does three things in order:

1. **Applies `posdb.sql`** — creates all 31 tables, indexes, triggers, and seeds the default Bella Vista restaurant
2. **Creates the SuperAdmin account** — safe to re-run (skips if already exists)
3. **Seeds test data** — 3 users, 26 menu items, 20 tables, 10 orders, 6 staff

**Expected output:**
```
Bella Vista POS — Database Seed
Mode: --setup (schema + seed)

[1/3] Schema Setup
  ✓ posdb.sql applied

[2/3] SuperAdmin
  ✓ Created  superadmin@pos.com / superadmin123

[3/3] Test Data
  ✓ Cleared existing data
  ✓ Users          (3)
  ✓ Menu items     (26)
  ✓ Tables         (20)
  ✓ Orders         (10) with line items
  ✓ Staff          (6)

Database ready.
```

#### Re-seed only (schema already applied)

```bash
cd server
npm run seed
```

Use this when you want to reset test data without re-running the schema.

#### Apply schema only (no seed)

```bash
cd server
psql -U posuser -d posdb -f database/posdb.sql
```

---

## Default Accounts

After running `npm run setup` the following accounts are available:

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| **SuperAdmin** | `superadmin@pos.com` | `superadmin123` | Manages all restaurants, global settings |
| **Admin** | `admin@pos.com` | `admin123` | Full access within restaurant |
| **Waiter** | `waiter@pos.com` | `waiter123` | Tables, orders |
| **Cashier** | `cashier@pos.com` | `cashier123` | Sell screen, cash flow |

> **Security:** Change all passwords and rotate `JWT_SECRET` / `JWT_REFRESH_SECRET` before going to production.

---

## API Overview

All API routes are prefixed with `/api`.

| Category | Base path | Auth |
|----------|-----------|------|
| Auth | `/api/auth` | Public |
| Email / Password reset | `/api/email` | Mixed |
| Public QR ordering | `/api/public` | None |
| SuperAdmin | `/api/superadmin` | SuperAdmin JWT |
| Orders | `/api/orders` | Staff JWT + restaurant scope |
| Tables | `/api/tables` | Staff JWT + restaurant scope |
| Menu | `/api/menu` | Staff JWT + restaurant scope |
| Staff | `/api/staff` | Staff JWT + restaurant scope |
| Customers | `/api/customers` | Staff JWT + restaurant scope |
| Suppliers | `/api/suppliers` | Staff JWT + restaurant scope |
| Cash Flow | `/api/cashflow` | Staff JWT + restaurant scope |
| Returns | `/api/returns` | Staff JWT + restaurant scope |
| Zones | `/api/zones` | Staff JWT + restaurant scope |
| Sales Channels | `/api/sales-channels` | Staff JWT + restaurant scope |
| Shifts | `/api/shifts` | Staff JWT + restaurant scope |
| Stock Takes | `/api/stock-takes` | Staff JWT + restaurant scope |
| Price Books | `/api/price-books` | Staff JWT + restaurant scope |
| Purchase Orders | `/api/purchase-orders` | Staff JWT + restaurant scope |
| Purchase Returns | `/api/purchase-returns` | Staff JWT + restaurant scope |
| Damage Records | `/api/damage-records` | Staff JWT + restaurant scope |
| Promotions | `/api/promotions` | Staff JWT + restaurant scope |
| Settings | `/api/settings` | Staff JWT + restaurant scope |
| Reports / Stats | `/api/stats` | Staff JWT + restaurant scope |
| Audit Logs | `/api/audit-logs` | Staff JWT + restaurant scope |

**Health check** (no auth): `GET /health`

---

## Deployment

### Overview

| Component | Suggested platform |
|-----------|-------------------|
| Frontend | Vercel / Netlify / Nginx static |
| Backend | Railway / Render / DigitalOcean App Platform / VPS |
| Database | Neon / Supabase / RDS / managed PostgreSQL |

---

### Step 1 — Build the frontend

```bash
cd client
npm run build
```

Output goes to `client/dist/`. Deploy this folder to any static host or serve it from Nginx.

To preview the production build locally:

```bash
npm run preview
# Opens at http://localhost:4173
```

---

### Step 2 — Configure production environment variables

On your server / hosting platform set these environment variables (never commit `.env` to git):

```env
NODE_ENV=production
PORT=3001

# PostgreSQL (use your managed DB connection string or individual vars)
DB_HOST=<your-db-host>
DB_PORT=5432
DB_USER=<your-db-user>
DB_PASSWORD=<your-db-password>
DB_NAME=posdb

# JWT — use long, random strings in production (min 32 chars)
JWT_SECRET=<random-64-char-string>
JWT_EXPIRES_IN=8h
JWT_REFRESH_SECRET=<another-random-64-char-string>
JWT_REFRESH_EXPIRES_IN=7d

# CORS — set to your real frontend domain
CLIENT_ORIGIN=https://your-frontend-domain.com

TAX_RATE=0.10

# SMTP — required for password reset in production
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=you@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM_NAME=POS System
EMAIL_FROM_ADDRESS=noreply@yourdomain.com
APP_URL=https://your-frontend-domain.com
```

Generate secure secrets:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

### Step 3 — Apply the database schema

On first deployment, run the schema against your production database:

```bash
# Option A: psql directly
psql -U <user> -h <host> -d posdb -f server/database/posdb.sql

# Option B: via Node (no test data, schema only)
cd server
node -e "
  require('dotenv').config()
  const fs = require('fs')
  const { pool } = require('./src/config/db')
  pool.query(fs.readFileSync('./database/posdb.sql','utf8'))
    .then(() => { console.log('Schema applied'); process.exit(0) })
    .catch(e => { console.error(e.message); process.exit(1) })
"
```

> **Do not run `npm run seed` in production** — it truncates all data.

---

### Step 4 — Start the backend

```bash
cd server
npm start         # node server.js
```

For process management with auto-restart use **PM2**:

```bash
npm install -g pm2

# Start
pm2 start server.js --name pos-api

# Auto-restart on reboot
pm2 startup
pm2 save

# Useful commands
pm2 logs pos-api      # Stream logs
pm2 status            # Show all processes
pm2 restart pos-api   # Manual restart
```

---

### Step 5 — Serve the frontend (Nginx example)

If you're self-hosting on a VPS, use Nginx to serve the static files and reverse-proxy the API.

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Serve React SPA
    root /var/www/pos/client/dist;
    index index.html;

    # All frontend routes → index.html (React Router)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API calls to Express
    location /api/ {
        proxy_pass         http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Proxy WebSocket (Socket.IO)
    location /socket.io/ {
        proxy_pass         http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'Upgrade';
        proxy_set_header   Host $host;
    }
}
```

Then enable HTTPS with Certbot:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

### Step 6 — Deploy to Vercel + Railway (cloud option)

#### Frontend → Vercel

```bash
npm install -g vercel
cd client
vercel --prod
```

Set these in the Vercel project dashboard → Settings → Environment Variables:

> No variables needed — the frontend has no `.env`. Just make sure your backend URL is reachable.

Since Vite's proxy only works in dev, for production you need to point the frontend at your real API. Add a `VITE_API_URL` or configure Vercel rewrites in `client/vercel.json`:

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://your-api.railway.app/api/:path*" },
    { "source": "/socket.io/:path*", "destination": "https://your-api.railway.app/socket.io/:path*" }
  ]
}
```

#### Backend → Railway

1. Push `server/` to a GitHub repo
2. Create a new Railway project → Deploy from GitHub
3. Add environment variables in Railway dashboard
4. Railway provides a PostgreSQL plugin — add it and copy the `DATABASE_URL` or individual vars

---

## Environment Variables Reference

Complete reference for `server/.env`:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3001` | Port the Express server listens on |
| `NODE_ENV` | No | `development` | `development` or `production` |
| `DB_HOST` | Yes | `localhost` | PostgreSQL hostname |
| `DB_PORT` | Yes | `5432` | PostgreSQL port |
| `DB_USER` | Yes | `posuser` | PostgreSQL username |
| `DB_PASSWORD` | Yes | `pospassword` | PostgreSQL password |
| `DB_NAME` | Yes | `posdb` | PostgreSQL database name |
| `JWT_SECRET` | Yes | — | Secret for signing access tokens (min 32 chars) |
| `JWT_EXPIRES_IN` | No | `8h` | Access token lifetime |
| `JWT_REFRESH_SECRET` | Yes | — | Secret for signing refresh tokens (min 32 chars) |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | Refresh token lifetime |
| `CLIENT_ORIGIN` | Yes | `http://localhost:5173` | Frontend URL (CORS allowed origin) |
| `TAX_RATE` | No | `0.10` | Default tax rate applied to orders (0.10 = 10%) |
| `SMTP_HOST` | No | — | SMTP server hostname. Leave empty in dev (auto-Ethereal) |
| `SMTP_PORT` | No | `587` | SMTP port |
| `SMTP_SECURE` | No | `false` | `true` for port 465 (TLS), `false` for STARTTLS |
| `SMTP_USER` | No | — | SMTP login username |
| `SMTP_PASS` | No | — | SMTP login password |
| `EMAIL_FROM_NAME` | No | `POS System` | Display name in outgoing emails |
| `EMAIL_FROM_ADDRESS` | No | `noreply@pos.system` | Sender address in outgoing emails |
| `APP_URL` | No | `http://localhost:5173` | Frontend base URL used in password reset links |

---

## Quick Reference

```bash
# ── Dev ──────────────────────────────────────────────────────────────────────
cd server && npm run dev          # Start backend  (http://localhost:3001)
cd client && npm run dev          # Start frontend (http://localhost:5173)

# ── Database ─────────────────────────────────────────────────────────────────
cd server && npm run setup        # Fresh install: apply schema + seed data
cd server && npm run seed         # Reset test data only (keep schema)

# ── Production ───────────────────────────────────────────────────────────────
cd client && npm run build        # Build frontend → client/dist/
cd server && npm start            # Start backend (production)
pm2 start server/server.js --name pos-api   # With process manager

# ── Utilities ────────────────────────────────────────────────────────────────
curl http://localhost:3001/health            # Health check
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"  # Generate secret
```
