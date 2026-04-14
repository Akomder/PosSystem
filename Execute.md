# POS System - Execute Guide

This file is the full operational runbook for this repository.
It covers:
- Local setup and first run
- Database migration and seed
- Validation and testing workflow
- Production deployment for API + website

Repository structure:
- client: React + Vite frontend
- server: Node.js + Express + Socket.IO backend
- docker-compose.yml: local PostgreSQL service

## 1) Prerequisites

Required versions:
- Node.js 20 or newer
- npm 10 or newer
- Docker Desktop (for local PostgreSQL)

Open two terminals from repository root:
- Terminal A for backend
- Terminal B for frontend

## 2) Install Dependencies

Run these commands:

1. Backend dependencies
   - cd server
   - npm install

2. Frontend dependencies
   - cd ../client
   - npm install

## 3) Environment Setup

Backend env file is server/.env.
Current local defaults in this project:
- PORT=3001
- DB_HOST=localhost
- DB_PORT=5432
- DB_USER=pos
- DB_PASSWORD=Lionelakom_1234
- DB_NAME=posdb
- CLIENT_ORIGIN=http://localhost:5173
- CLIENT_URL=http://localhost:5173

Important:
- Change DB_PASSWORD and JWT secrets before production.
- CLIENT_ORIGIN and CLIENT_URL must match your frontend domain in production.

## 4) Database Setup

Option A (recommended local): Docker PostgreSQL

From repository root:
- docker compose up -d

Verify container:
- docker ps

Service details from docker-compose.yml:
- image: postgres:16
- user: pos
- password: Lionelakom_1234
- database: posdb
- port: 5432

Option B (manual PostgreSQL)

If you do not use Docker, create DB and user manually:
- CREATE USER pos WITH PASSWORD 'Lionelakom_1234';
- CREATE DATABASE posdb OWNER pos;

Then ensure server/.env matches your manual credentials.

## 5) Run Migrations

This repository uses direct migration scripts (no npm migration script).

From server folder:
- node database/runMigration.js
- node database/runMigrationKeivi.js

What they do:
- runMigration.js: applies multi-tenancy migration and ensures SuperAdmin exists
- runMigrationKeivi.js: applies additional Keivi feature migration

Expected SuperAdmin created by migration (if missing):
- Email: superadmin@pos.com
- Password: superadmin123

## 6) Optional Seed Data

From server folder:
- npm run seed

Expected seeded users:
- admin@pos.com / admin123
- waiter@pos.com / waiter123
- cashier@pos.com / cashier123

Note:
- Seeding truncates and repopulates core tables.
- Do not run seed on production unless intentionally resetting data.

## 7) Start Project Locally

Start backend (Terminal A):
- cd server
- npm run dev

Backend should run on:
- http://localhost:3001
- health: http://localhost:3001/health

Start frontend (Terminal B):
- cd client
- npm run dev

Frontend should run on:
- http://localhost:5173

Vite proxy in this project forwards:
- /api -> http://localhost:3001
- /socket.io -> http://localhost:3001 (ws enabled)

## 8) Test and Validate

There is no backend automated test script in server/package.json.
Current validation flow is lint + manual smoke tests.

Frontend lint:
- cd client
- npm run lint

Manual API checks:
- GET http://localhost:3001/health returns status ok
- Login via frontend page /login
- Create order and verify realtime updates (Socket.IO)

Manual feature checks:
- Regular restaurant routes: dashboard, orders, tables, menu, customers, suppliers, cashflow, reports, invoices, returns, sell
- SuperAdmin routes: /superadmin, /superadmin/restaurants, /superadmin/restaurants/:id, /superadmin/email
- Public QR order route: /order/:tableId

Database validation:
- confirm users table has SuperAdmin and seeded users (if seed executed)
- create and close an order, verify persistence in orders and order_items

## 9) Build for Production

Frontend production build:
- cd client
- npm run build

Output folder:
- client/dist

Backend production start:
- cd server
- npm start

## 10) Deploy to Real Server (Application + Website)

Recommended production topology:
- PostgreSQL managed by server host or managed DB service
- Node backend as systemd service on localhost:3001
- Nginx as reverse proxy and static frontend host
- HTTPS via Let's Encrypt

### 10.1 Provision Server

Install packages:
- Node.js 20+
- npm
- nginx
- postgresql (or connect to external managed Postgres)

Create app directory, for example:
- /var/www/pos-system

Upload project to server.

### 10.2 Install and Build on Server

From app root on server:
- cd server && npm ci
- cd ../client && npm ci
- npm run build

### 10.3 Configure Production Environment

Create server/.env with production values, for example:
- NODE_ENV=production
- PORT=3001
- DB_HOST=127.0.0.1
- DB_PORT=5432
- DB_USER=pos
- DB_PASSWORD=<strong-password>
- DB_NAME=posdb
- JWT_SECRET=<strong-random-secret>
- JWT_REFRESH_SECRET=<strong-random-secret>
- CLIENT_ORIGIN=https://your-domain.com
- CLIENT_URL=https://your-domain.com
- APP_URL=https://your-domain.com
- SMTP_HOST=<smtp-host-or-empty>
- SMTP_PORT=587
- SMTP_SECURE=false
- SMTP_USER=<smtp-user>
- SMTP_PASS=<smtp-pass>
- EMAIL_FROM_NAME=POS System
- EMAIL_FROM_ADDRESS=noreply@your-domain.com

Run migrations in production once:
- cd server
- node database/runMigration.js
- node database/runMigrationKeivi.js

Run seed in production only if you intentionally need demo data.

### 10.4 Run Backend as a systemd Service

Create /etc/systemd/system/pos-api.service with content:

[Unit]
Description=POS API Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/pos-system/server
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target

Then enable and start:
- sudo systemctl daemon-reload
- sudo systemctl enable pos-api
- sudo systemctl start pos-api
- sudo systemctl status pos-api

### 10.5 Configure Nginx for Website + API + Socket.IO

Create Nginx site config (example /etc/nginx/sites-available/pos-system):

server {
    listen 80;
    server_name your-domain.com;

    root /var/www/pos-system/client/dist;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}

Enable site and reload:
- sudo ln -s /etc/nginx/sites-available/pos-system /etc/nginx/sites-enabled/pos-system
- sudo nginx -t
- sudo systemctl reload nginx

### 10.6 Enable HTTPS

Install certbot and issue certificate:
- sudo certbot --nginx -d your-domain.com

Then verify auto-renew:
- sudo certbot renew --dry-run

## 11) Production Verification Checklist

After deployment, validate:
- website loads at https://your-domain.com
- API health works via reverse proxy path and direct backend health
- login works for SuperAdmin and regular users
- realtime updates work (Socket.IO through Nginx)
- migrations applied and data reads/writes succeed
- password reset flow works with SMTP or Ethereal fallback
- service auto-restarts after reboot

Useful checks:
- sudo systemctl status pos-api
- sudo journalctl -u pos-api -f
- sudo nginx -t
- curl -I https://your-domain.com
- curl https://your-domain.com/api/public/ping (if route exists)

## 12) Troubleshooting

Issue: Migration failed password authentication for user pos
- Confirm server/.env DB_USER and DB_PASSWORD match actual DB user credentials
- Confirm Docker postgres env matches .env if using compose
- If using old Docker volume, recreate DB or reset credentials inside postgres

Issue: CORS errors
- Ensure CLIENT_ORIGIN and CLIENT_URL are set to exact frontend origin
- Ensure frontend accesses backend through same domain reverse proxy in production

Issue: Socket not connecting in production
- Ensure Nginx location /socket.io/ has Upgrade and Connection headers
- Ensure firewall allows HTTPS and backend listens locally

Issue: Frontend refresh gives 404
- Ensure Nginx root uses try_files $uri /index.html;

## 13) Quick Command Summary

Local first run:
- docker compose up -d
- cd server && npm install
- cd ../client && npm install
- cd ../server && node database/runMigration.js
- node database/runMigrationKeivi.js
- npm run seed
- npm run dev
- cd ../client && npm run dev

Local validation:
- cd client && npm run lint
- open http://localhost:5173
- check http://localhost:3001/health

Production:
- build frontend in client/dist
- run backend with systemd on port 3001
- serve client/dist via nginx
- proxy /api and /socket.io to backend
- enable HTTPS with certbot
