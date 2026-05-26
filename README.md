# POS System — Feature Roadmap

## 📊 Status Overview

| Phase | Steps | Status |
|-------|-------|--------|
| **Phase 1** | 1–4 (Modifiers, Payments, Receipts, Offline) | ✅ Complete |
| **Phase 2** | A–F (SuperAdmin Features) | ✅ Complete |
| **Phase 3** | 5–9 (Order Features) | ✅ Complete |
| **Phase 4** | EOD Email | ✅ Complete |

---

## Phase 1: Core POS Features ✅ COMPLETE

### ✅ Step 1 — Modifier Groups
Customization system for menu items (sizes, toppings, etc.). Full implementation with DB tables, API, and UI.

### ✅ Step 2 — Split/Multi-Tender Payments  
Multiple payment methods per order (cash + card splits). `order_payments` table with full reconciliation.

### ✅ Step 3 — Receipt Printing
80mm thermal receipt + kitchen tickets. HTML rendering via print templates.

### ✅ Step 4 — Offline Mode / PWA
Service worker + IndexedDB queue for orders taken offline. Auto-sync on reconnect.

---

## Phase 2: SuperAdmin Features ✅ COMPLETE

### ✅ Step A — SMTP Settings Update

**Problem**: SMTP config is read-only; admin must SSH + edit `.env` + restart.

**Checklist:**
- [x] `system_settings` table in schema
- [x] `PUT /api/email/config` endpoint (`server/src/routes/email.js`)
- [x] `emailService` loads from DB on startup, falls back to `.env`
- [x] `EmailSettings.jsx` — fully editable with save/reload/test
- [x] Quick-fill buttons for Gmail, Outlook, Custom SMTP
- [x] Auto-runs test email after save

---

### ✅ Step B — SuperAdmin User Management

**Problem**: Can't create/list/delete SuperAdmin accounts from UI.

**Checklist:**
- [x] Backend: GET/POST/DELETE `/api/superadmin/admins`
- [x] `Admins.jsx` — table with create/delete modals
- [x] Sidebar link in `SuperAdminLayout.jsx`
- [x] Route `/superadmin/admins` in `App.jsx`
- [x] Create modal (name, email, password)
- [x] Delete + self-delete protection ("You" indicator)

---

### ✅ Step C — Staff Password Reset

**Problem**: SuperAdmin can't reset forgotten staff passwords.

**Checklist:**
- [x] `PATCH /superadmin/restaurants/:id/staff/:uid/password`
- [x] "Reset PW" hover button on each staff row in `RestaurantDetail.jsx`
- [x] Modal with new password input (6+ char validation)
- [x] `superadminApi.resetStaffPassword()` wired up

---

### ✅ Step D — Plan Limits Enforcement

**Problem**: Plan field exists but is cosmetic (no enforcement).

**Checklist:**
- [x] `planLimits.js` — basic/pro/enterprise limits defined
- [x] `staffController.createStaff()` — checks maxStaff, returns 403
- [x] `tablesController.createTable()` — checks maxTables, returns 403
- [x] `menuController.createItem()` — checks maxMenuItems, returns 403
- [x] `PlanLimitBanner.jsx` — amber/red warning component
- [x] Banner integrated in Menu, Tables, and Staff pages

---

### ✅ Step E — Audit Log

**Problem**: No record of SuperAdmin actions.

**Checklist:**
- [x] `audit_logs` table in DB schema
- [x] `audit.js` — `logAction()` helper (non-blocking)
- [x] All mutating SA endpoints call `logAction()`
- [x] `AuditLog.jsx` — paginated table with filters
- [x] Sidebar link + route in `App.jsx`
- [x] Filters: action type, restaurant, date range

---

### ✅ Step F — Broadcast Announcement

**Problem**: Can't notify all restaurant admins.

**Checklist:**
- [x] `POST /api/superadmin/broadcast` — sends via `emailService.sendMail()`
- [x] "Broadcast" button (Megaphone icon) in `Restaurants.jsx` header
- [x] Modal — subject, message, all-active or targeted by restaurant
- [x] Result summary shows sent/failed counts

---

## Phase 3: Order & Inventory Features ✅ COMPLETE

### ✅ Step 5 — Order Cancellation & Void Flow

**Problem**: No way to cancel bad orders; Cancel button mis-wired.

**Checklist:**
- [x] `cancel_reason` column added to orders table (schema migration)
- [x] `'Cancelled'` in VALID_STATUSES + status CHECK constraint updated
- [x] Cancel button in Orders.jsx opens CancelModal with reason picker
- [x] CancelModal loads reasons from `settingsApi.cancelReasons.getAll()`
- [x] Cancelled orders free the table (`current_order_id` cleared)
- [x] Cancelled status → `danger` badge (red), terminal state

---

### ✅ Step 6 — Shift Cash Reconciliation

**Problem**: Closing cash never validated against expected amount.

**Checklist:**
- [x] `expected_cash`, `cash_variance` columns added to shifts (schema migration)
- [x] `closeShift()` computes expected = opening + cash payments since shift
- [x] `getCurrent()` returns live `expectedCash` for open-shift preview
- [x] Close modal shows Expected Closing Cash + color-coded Variance badge
- [x] Shift history table shows Expected and Variance columns

---

### ✅ Step 7 — Kitchen Station Routing + Item-Level Bump

**Problem**: All items on single KDS screen; can't mark individual items done.

**Checklist:**
- [x] `station` column on menu_items & order_items (schema migration)
- [x] `createOrder()` copies station snapshot from menu item
- [x] Kitchen.jsx has station filter pills (dynamic from order data)
- [x] Each item has ✓ done button → `PATCH /orders/:id/items/:itemId/done`
- [x] Done items show strikethrough + opacity
- [x] Menu.jsx item edit modal has Station field

---

### ✅ Step 8 — Reports Export (CSV + Print)

**Problem**: No way to export report data.

**Checklist:**
- [x] `exportCsv()` utility in Reports.jsx (no external dep)
- [x] "Export CSV" button in report header (each report type has column schema)
- [x] "Print" button calls `window.print()` with `@media print` hiding UI chrome

---

### ✅ Step 9 — Inventory Deduction on Order

**Problem**: No stock tracking; no low-stock alerts.

**Checklist:**
- [x] `stock_quantity`, `low_stock_threshold` columns on menu_items (schema migration)
- [x] `createOrder()` deducts stock, auto-marks unavailable at 0
- [x] `emitStockLow()` fires socket event when below threshold
- [x] Menu.jsx "Track Stock" toggle + current stock + threshold inputs
- [x] AppContext listens for `stock:low` → toast notification

---

---

## Phase 4: EOD Email ✅ COMPLETE

### ✅ EOD Shift Summary Email

**Problem**: Closing a shift never notified the Admin with a revenue summary.

**Checklist:**
- [x] `sendShiftSummary()` in `emailService.js` — HTML email with full shift breakdown
- [x] Exported from `emailService.js`
- [x] `closeShift()` in `shiftsController.js` — queries Admin emails, fires `sendShiftSummary` non-blocking after COMMIT
- [x] Email includes: opened/closed times, staff, total orders/revenue, cash reconciliation, variance (green ≤1000 LAK, red >1000 LAK)

---

## Quick Reference

**All phases complete. Manual verification steps:**

**Phase 2:**
- 2A: SuperAdmin → `/superadmin/email` → edit SMTP → Save & Reload → test email arrives
- 2B: `/superadmin/admins` → Add SuperAdmin → login as new account → delete it
- 2C: `/superadmin/restaurants/:id` → hover staff row → Reset PW → login with new password
- 2D: Set restaurant to `basic` → add 5 staff → attempt 6th → 403 "Plan limit reached"
- 2E: Any SuperAdmin action → `/superadmin/audit-log` → entry visible
- 2F: `/superadmin/restaurants` → Broadcast → send → admin emails receive it

**Phase 3:**
- Step 5: Create order → Cancel → pick reason → status shows Cancelled; table freed
- Step 6: Open shift → process cash order → close shift → Expected vs Actual shown
- Step 7: Set item station to "Bar" → Kitchen page → click "Bar" pill → only bar items shown; ✓ item → strikethrough
- Step 8: Reports → Sales → Export CSV → file downloads with correct rows
- Step 9: Set `stock_quantity=2` on menu item → 3 orders using it → item auto-unavailable

**DB setup:** Run `server/database/posdb.sql` against a fresh PostgreSQL database.

**Status last updated**: 2026-05-25
