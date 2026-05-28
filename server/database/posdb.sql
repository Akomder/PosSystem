-- ════════════════════════════════════════════════════════════════════════════
--  Bella Vista POS — Complete Database Schema
--  PostgreSQL 16
--
--  Run on a fresh database:
--    psql -U postgres -d your_db -f posdb.sql
--
--  Sections
--    1.  Shared trigger function
--    2.  Core tables  (users, staff, menu_items, restaurant_tables, orders, order_items)
--    3.  Multi-tenancy  (restaurants, restaurant_id columns, extra order columns)
--    4.  Keivi FNB features  (zones, channels, shifts, stock takes, price books,
--        purchase orders, purchase returns, damage records, settings, promotions,
--        audit log)
--    5.  All indexes
--    6.  All auto-update triggers
--    7.  Seed data
-- ════════════════════════════════════════════════════════════════════════════


-- ─── 1. Shared trigger function ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ─── 2. Core tables ──────────────────────────────────────────────────────────

-- RESTAURANTS (created before users so FK can reference it)
CREATE TABLE IF NOT EXISTS restaurants (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  slug        VARCHAR(100) UNIQUE,
  address     TEXT         NOT NULL DEFAULT '',
  phone       VARCHAR(50)  NOT NULL DEFAULT '',
  email       VARCHAR(200) NOT NULL DEFAULT '',
  logo_url    TEXT,
  plan        VARCHAR(20)  NOT NULL DEFAULT 'basic'
                CHECK (plan IN ('basic','pro','enterprise')),
  status      VARCHAR(20)  NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','suspended','inactive')),
  tax_rate    NUMERIC(5,4) NOT NULL DEFAULT 0.10,
  currency    VARCHAR(10)  NOT NULL DEFAULT 'LAK',
  settings    JSONB        NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- USERS (authentication credentials)
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  restaurant_id INTEGER      REFERENCES restaurants(id) ON DELETE SET NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20)  NOT NULL CHECK (role IN ('SuperAdmin','Admin','Waiter','Cashier')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- STAFF (profile — linked to users)
CREATE TABLE IF NOT EXISTS staff (
  id               SERIAL PRIMARY KEY,
  restaurant_id    INTEGER      REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id          INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  name             VARCHAR(100) NOT NULL,
  role             VARCHAR(20)  NOT NULL CHECK (role IN ('Admin','Waiter','Cashier')),
  status           VARCHAR(20)  NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','inactive','on-leave')),
  email            VARCHAR(255),
  avatar           VARCHAR(500),
  tables_assigned  INTEGER[]    NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- MENU ITEMS
CREATE TABLE IF NOT EXISTS menu_items (
  id             SERIAL PRIMARY KEY,
  restaurant_id  INTEGER        REFERENCES restaurants(id) ON DELETE CASCADE,
  name           VARCHAR(150)   NOT NULL,
  category       VARCHAR(30)    NOT NULL CHECK (category IN ('Starters','Mains','Drinks','Desserts')),
  price          NUMERIC(10,2)  NOT NULL CHECK (price > 0),
  cost_price     NUMERIC(10,2)  NOT NULL DEFAULT 0,
  description    TEXT           NOT NULL DEFAULT '',
  available      BOOLEAN        NOT NULL DEFAULT TRUE,
  stock          INTEGER        NOT NULL DEFAULT 0 CHECK (stock >= 0),
  min_stock      INTEGER        NOT NULL DEFAULT 0,
  max_stock      INTEGER        NOT NULL DEFAULT 9999,
  tags           TEXT[]         NOT NULL DEFAULT '{}',
  prep_time      INTEGER        NOT NULL DEFAULT 10 CHECK (prep_time >= 0),
  product_code   VARCHAR(50),
  product_group  VARCHAR(100)   NOT NULL DEFAULT '',
  department     VARCHAR(100)   NOT NULL DEFAULT '',
  image_url      TEXT           NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- TABLE ZONES (must exist before restaurant_tables for FK)
CREATE TABLE IF NOT EXISTS table_zones (
  id            SERIAL PRIMARY KEY,
  restaurant_id INTEGER      REFERENCES restaurants(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  description   TEXT         NOT NULL DEFAULT '',
  color         VARCHAR(20)  NOT NULL DEFAULT '#14b8a6',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- RESTAURANT TABLES
-- Named "restaurant_tables" to avoid PostgreSQL reserved word "tables"
CREATE TABLE IF NOT EXISTS restaurant_tables (
  id               SERIAL PRIMARY KEY,
  restaurant_id    INTEGER      REFERENCES restaurants(id) ON DELETE CASCADE,
  zone_id          INTEGER      REFERENCES table_zones(id) ON DELETE SET NULL,
  number           INTEGER      NOT NULL,
  capacity         INTEGER      NOT NULL CHECK (capacity > 0),
  status           VARCHAR(20)  NOT NULL DEFAULT 'Available'
                     CHECK (status IN ('Available','Occupied','Reserved')),
  waiter           VARCHAR(100),
  current_order_id INTEGER,          -- FK added below (circular dep)
  section          VARCHAR(30)  NOT NULL CHECK (section IN ('Main Hall','Terrace','Private')),
  position_row     INTEGER      NOT NULL DEFAULT 0,
  position_col     INTEGER      NOT NULL DEFAULT 0,
  -- Floor-plan layout (customisable via Map Editor)
  map_x            INTEGER      NOT NULL DEFAULT 0,
  map_y            INTEGER      NOT NULL DEFAULT 0,
  map_w            INTEGER      NOT NULL DEFAULT 2,
  map_h            INTEGER      NOT NULL DEFAULT 2,
  map_shape        TEXT         NOT NULL DEFAULT 'rect',
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (number, restaurant_id)
);

-- CUSTOMERS
CREATE TABLE IF NOT EXISTS customers (
  id            SERIAL PRIMARY KEY,
  restaurant_id INTEGER      REFERENCES restaurants(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,
  email         VARCHAR(255),
  phone         VARCHAR(50),
  address       TEXT         NOT NULL DEFAULT '',
  notes         TEXT         NOT NULL DEFAULT '',
  group_name    VARCHAR(50)  NOT NULL DEFAULT 'General',
  loyalty_pts   INTEGER      NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- SALES CHANNELS
CREATE TABLE IF NOT EXISTS sales_channels (
  id            SERIAL PRIMARY KEY,
  restaurant_id INTEGER      REFERENCES restaurants(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  description   TEXT         NOT NULL DEFAULT '',
  active        BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ORDERS
CREATE TABLE IF NOT EXISTS orders (
  id               SERIAL PRIMARY KEY,
  restaurant_id    INTEGER        REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id         INTEGER        REFERENCES restaurant_tables(id) ON DELETE RESTRICT,
  table_number     INTEGER,
  customer_id      INTEGER        REFERENCES customers(id) ON DELETE SET NULL,
  sales_channel_id INTEGER        REFERENCES sales_channels(id) ON DELETE SET NULL,
  order_type       VARCHAR(20)    NOT NULL DEFAULT 'Dine In'
                     CHECK (order_type IN ('Dine In','Takeaway','Delivery')),
  waiter           VARCHAR(100)   NOT NULL DEFAULT 'Unassigned',
  status           VARCHAR(20)    NOT NULL DEFAULT 'Pending'
                     CHECK (status IN ('Pending','In Progress','Served','Closed')),
  subtotal         NUMERIC(10,2)  NOT NULL DEFAULT 0,
  tax              NUMERIC(10,2)  NOT NULL DEFAULT 0,
  discount         NUMERIC(10,2)  NOT NULL DEFAULT 0,
  total            NUMERIC(10,2)  NOT NULL DEFAULT 0,
  payment_method   VARCHAR(50)    NOT NULL DEFAULT 'cash',
  currency         VARCHAR(10)    NOT NULL DEFAULT 'LAK',
  voucher_code     VARCHAR(100)   NOT NULL DEFAULT '',
  cash_tendered    NUMERIC(10,2)  NOT NULL DEFAULT 0,
  change_amount    NUMERIC(10,2)  NOT NULL DEFAULT 0,
  notes            TEXT           NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- DEFERRED FK: restaurant_tables.current_order_id → orders
ALTER TABLE restaurant_tables
  ADD CONSTRAINT fk_current_order
  FOREIGN KEY (current_order_id) REFERENCES orders(id) ON DELETE SET NULL;

-- ORDER ITEMS (line items)
CREATE TABLE IF NOT EXISTS order_items (
  id            SERIAL PRIMARY KEY,
  restaurant_id INTEGER        REFERENCES restaurants(id) ON DELETE CASCADE,
  order_id      INTEGER        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id  INTEGER        NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
  name          VARCHAR(150)   NOT NULL,    -- snapshot at order time
  quantity      INTEGER        NOT NULL CHECK (quantity > 0),
  unit_price    NUMERIC(10,2)  NOT NULL CHECK (unit_price > 0),
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- SUPPLIERS
CREATE TABLE IF NOT EXISTS suppliers (
  id            SERIAL PRIMARY KEY,
  restaurant_id INTEGER      REFERENCES restaurants(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,
  contact       VARCHAR(100) NOT NULL DEFAULT '',
  email         VARCHAR(255),
  phone         VARCHAR(50),
  address       TEXT         NOT NULL DEFAULT '',
  notes         TEXT         NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- CASH FLOW ENTRIES
CREATE TABLE IF NOT EXISTS cash_flow_entries (
  id            SERIAL PRIMARY KEY,
  restaurant_id INTEGER        REFERENCES restaurants(id) ON DELETE CASCADE,
  type          VARCHAR(20)    NOT NULL CHECK (type IN ('income','expense')),
  category      VARCHAR(100)   NOT NULL DEFAULT '',
  description   TEXT           NOT NULL DEFAULT '',
  amount        NUMERIC(10,2)  NOT NULL CHECK (amount > 0),
  status        VARCHAR(20)    NOT NULL DEFAULT 'paid' CHECK (status IN ('paid','pending')),
  reference     VARCHAR(100)   NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- RETURNS (customer returns)
CREATE TABLE IF NOT EXISTS returns (
  id            SERIAL PRIMARY KEY,
  restaurant_id INTEGER        REFERENCES restaurants(id) ON DELETE CASCADE,
  order_id      INTEGER        REFERENCES orders(id) ON DELETE SET NULL,
  reason        TEXT           NOT NULL DEFAULT '',
  status        VARCHAR(20)    NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected','completed')),
  total         NUMERIC(10,2)  NOT NULL DEFAULT 0,
  processed_by  VARCHAR(100)   NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS return_items (
  id            SERIAL PRIMARY KEY,
  return_id     INTEGER        NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  menu_item_id  INTEGER        REFERENCES menu_items(id) ON DELETE SET NULL,
  item_name     VARCHAR(150)   NOT NULL,
  quantity      INTEGER        NOT NULL CHECK (quantity > 0),
  unit_price    NUMERIC(10,2)  NOT NULL DEFAULT 0,
  line_total    NUMERIC(10,2)  GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);


-- ─── 3. Keivi FNB feature tables ─────────────────────────────────────────────

-- SHIFTS
CREATE TABLE IF NOT EXISTS shifts (
  id            SERIAL PRIMARY KEY,
  restaurant_id INTEGER        REFERENCES restaurants(id) ON DELETE CASCADE,
  staff_id      INTEGER        REFERENCES staff(id) ON DELETE SET NULL,
  opened_by     VARCHAR(100)   NOT NULL DEFAULT '',
  closed_by     VARCHAR(100)   NOT NULL DEFAULT '',
  opened_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  closed_at     TIMESTAMPTZ,
  opening_cash  NUMERIC(10,2)  NOT NULL DEFAULT 0,
  closing_cash  NUMERIC(10,2)  NOT NULL DEFAULT 0,
  total_sales   NUMERIC(10,2)  NOT NULL DEFAULT 0,
  total_orders  INTEGER        NOT NULL DEFAULT 0,
  notes         TEXT           NOT NULL DEFAULT '',
  status        VARCHAR(20)    NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','closed')),
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- STOCK TAKES
CREATE TABLE IF NOT EXISTS stock_takes (
  id            SERIAL PRIMARY KEY,
  restaurant_id INTEGER      REFERENCES restaurants(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,
  status        VARCHAR(20)  NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','in_progress','completed')),
  conducted_by  VARCHAR(100) NOT NULL DEFAULT '',
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  notes         TEXT         NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_take_items (
  id            SERIAL PRIMARY KEY,
  stock_take_id INTEGER        NOT NULL REFERENCES stock_takes(id) ON DELETE CASCADE,
  menu_item_id  INTEGER        REFERENCES menu_items(id) ON DELETE SET NULL,
  item_name     VARCHAR(150)   NOT NULL,
  expected_qty  INTEGER        NOT NULL DEFAULT 0,
  actual_qty    INTEGER        NOT NULL DEFAULT 0,
  variance      INTEGER        GENERATED ALWAYS AS (actual_qty - expected_qty) STORED,
  unit_cost     NUMERIC(10,2)  NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- PRICE BOOKS
CREATE TABLE IF NOT EXISTS price_books (
  id            SERIAL PRIMARY KEY,
  restaurant_id INTEGER      REFERENCES restaurants(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,
  description   TEXT         NOT NULL DEFAULT '',
  valid_from    DATE,
  valid_to      DATE,
  active        BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS price_book_items (
  id            SERIAL PRIMARY KEY,
  price_book_id INTEGER        NOT NULL REFERENCES price_books(id) ON DELETE CASCADE,
  menu_item_id  INTEGER        NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  custom_price  NUMERIC(10,2)  NOT NULL CHECK (custom_price >= 0),
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  UNIQUE (price_book_id, menu_item_id)
);

-- PURCHASE ORDERS
CREATE TABLE IF NOT EXISTS purchase_orders (
  id            SERIAL PRIMARY KEY,
  restaurant_id INTEGER        REFERENCES restaurants(id) ON DELETE CASCADE,
  supplier_id   INTEGER        REFERENCES suppliers(id) ON DELETE SET NULL,
  reference_no  VARCHAR(100)   NOT NULL DEFAULT '',
  status        VARCHAR(20)    NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','ordered','received','cancelled')),
  ordered_at    TIMESTAMPTZ,
  expected_at   DATE,
  received_at   TIMESTAMPTZ,
  notes         TEXT           NOT NULL DEFAULT '',
  total         NUMERIC(10,2)  NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                SERIAL PRIMARY KEY,
  purchase_order_id INTEGER        NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  menu_item_id      INTEGER        REFERENCES menu_items(id) ON DELETE SET NULL,
  item_name         VARCHAR(150)   NOT NULL,
  quantity_ordered  INTEGER        NOT NULL CHECK (quantity_ordered > 0),
  quantity_received INTEGER        NOT NULL DEFAULT 0,
  unit_cost         NUMERIC(10,2)  NOT NULL DEFAULT 0,
  line_total        NUMERIC(10,2)  GENERATED ALWAYS AS (quantity_ordered * unit_cost) STORED,
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- PURCHASE RETURNS (to supplier)
CREATE TABLE IF NOT EXISTS purchase_returns (
  id                SERIAL PRIMARY KEY,
  restaurant_id     INTEGER        REFERENCES restaurants(id) ON DELETE CASCADE,
  supplier_id       INTEGER        REFERENCES suppliers(id) ON DELETE SET NULL,
  purchase_order_id INTEGER        REFERENCES purchase_orders(id) ON DELETE SET NULL,
  reference_no      VARCHAR(100)   NOT NULL DEFAULT '',
  reason            TEXT           NOT NULL DEFAULT '',
  status            VARCHAR(20)    NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','approved','completed')),
  total             NUMERIC(10,2)  NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_return_items (
  id                 SERIAL PRIMARY KEY,
  purchase_return_id INTEGER        NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
  menu_item_id       INTEGER        REFERENCES menu_items(id) ON DELETE SET NULL,
  item_name          VARCHAR(150)   NOT NULL,
  quantity           INTEGER        NOT NULL CHECK (quantity > 0),
  unit_cost          NUMERIC(10,2)  NOT NULL DEFAULT 0,
  line_total         NUMERIC(10,2)  GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  created_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- DAMAGE / WASTAGE RECORDS
CREATE TABLE IF NOT EXISTS damage_records (
  id            SERIAL PRIMARY KEY,
  restaurant_id INTEGER        REFERENCES restaurants(id) ON DELETE CASCADE,
  recorded_by   VARCHAR(100)   NOT NULL DEFAULT '',
  reason        VARCHAR(200)   NOT NULL DEFAULT '',
  notes         TEXT           NOT NULL DEFAULT '',
  total_value   NUMERIC(10,2)  NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS damage_record_items (
  id               SERIAL PRIMARY KEY,
  damage_record_id INTEGER        NOT NULL REFERENCES damage_records(id) ON DELETE CASCADE,
  menu_item_id     INTEGER        REFERENCES menu_items(id) ON DELETE SET NULL,
  item_name        VARCHAR(150)   NOT NULL,
  quantity         INTEGER        NOT NULL CHECK (quantity > 0),
  unit_cost        NUMERIC(10,2)  NOT NULL DEFAULT 0,
  line_total       NUMERIC(10,2)  GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- SETTINGS: CANCEL REASONS
CREATE TABLE IF NOT EXISTS cancel_reasons (
  id            SERIAL PRIMARY KEY,
  restaurant_id INTEGER      REFERENCES restaurants(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,
  active        BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- SETTINGS: NOTE TEMPLATES
CREATE TABLE IF NOT EXISTS note_templates (
  id            SERIAL PRIMARY KEY,
  restaurant_id INTEGER      REFERENCES restaurants(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,
  text          TEXT         NOT NULL DEFAULT '',
  active        BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- SETTINGS: PROCESSING SECTORS
CREATE TABLE IF NOT EXISTS processing_sectors (
  id            SERIAL PRIMARY KEY,
  restaurant_id INTEGER      REFERENCES restaurants(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,
  description   TEXT         NOT NULL DEFAULT '',
  active        BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- SETTINGS: PRINT TEMPLATES
CREATE TABLE IF NOT EXISTS print_templates (
  id            SERIAL PRIMARY KEY,
  restaurant_id INTEGER      REFERENCES restaurants(id) ON DELETE CASCADE,
  type          VARCHAR(20)  NOT NULL DEFAULT 'receipt'
                  CHECK (type IN ('receipt','kitchen','label')),
  name          VARCHAR(200) NOT NULL,
  content       TEXT         NOT NULL DEFAULT '',
  active        BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- PROMOTIONS / CAMPAIGNS
CREATE TABLE IF NOT EXISTS promotions (
  id              SERIAL PRIMARY KEY,
  restaurant_id   INTEGER        REFERENCES restaurants(id) ON DELETE CASCADE,
  name            VARCHAR(200)   NOT NULL,
  type            VARCHAR(20)    NOT NULL DEFAULT 'percent'
                    CHECK (type IN ('percent','fixed','buy_x_get_y')),
  value           NUMERIC(10,2)  NOT NULL DEFAULT 0,
  min_order_value NUMERIC(10,2)  NOT NULL DEFAULT 0,
  valid_from      DATE,
  valid_to        DATE,
  active          BOOLEAN        NOT NULL DEFAULT TRUE,
  usage_count     INTEGER        NOT NULL DEFAULT 0,
  usage_limit     INTEGER,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- AUDIT LOG
CREATE TABLE IF NOT EXISTS audit_logs (
  id            SERIAL PRIMARY KEY,
  restaurant_id INTEGER      REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id       INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  user_name     VARCHAR(100) NOT NULL DEFAULT '',
  action        VARCHAR(50)  NOT NULL,
  entity_type   VARCHAR(100) NOT NULL DEFAULT '',
  entity_id     VARCHAR(50)  NOT NULL DEFAULT '',
  old_data      JSONB,
  new_data      JSONB,
  ip_address    VARCHAR(50)  NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


-- ─── 4. Indexes ──────────────────────────────────────────────────────────────

-- Core
CREATE INDEX IF NOT EXISTS idx_orders_status          ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_table_id        ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_created         ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_ord        ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_menu_category          ON menu_items(category);
CREATE INDEX IF NOT EXISTS idx_menu_available         ON menu_items(available);
CREATE INDEX IF NOT EXISTS idx_staff_user             ON staff(user_id);

-- Multi-tenancy
CREATE INDEX IF NOT EXISTS idx_restaurants_status     ON restaurants(status);
CREATE INDEX IF NOT EXISTS idx_users_restaurant       ON users(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_staff_restaurant       ON staff(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_restaurant        ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_tables_restaurant      ON restaurant_tables(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant      ON orders(restaurant_id);

-- Keivi features
CREATE INDEX IF NOT EXISTS idx_shifts_restaurant      ON shifts(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status          ON shifts(status);
CREATE INDEX IF NOT EXISTS idx_stock_takes_restaurant ON stock_takes(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_rest   ON purchase_orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_sup    ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_damage_records_rest    ON damage_records(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_promotions_restaurant  ON promotions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_restaurant  ON audit_logs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created     ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_channels_rest    ON sales_channels(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_table_zones_rest       ON table_zones(restaurant_id);


-- ─── 5. Auto-update triggers ─────────────────────────────────────────────────

DO $$ BEGIN CREATE TRIGGER trg_restaurants_updated  BEFORE UPDATE ON restaurants       FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_users_updated        BEFORE UPDATE ON users             FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_staff_updated        BEFORE UPDATE ON staff             FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_menu_updated         BEFORE UPDATE ON menu_items        FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_zones_updated        BEFORE UPDATE ON table_zones       FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_tables_updated       BEFORE UPDATE ON restaurant_tables FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_customers_updated    BEFORE UPDATE ON customers         FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_channels_updated     BEFORE UPDATE ON sales_channels    FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_orders_updated       BEFORE UPDATE ON orders            FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_suppliers_updated    BEFORE UPDATE ON suppliers         FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_cashflow_updated     BEFORE UPDATE ON cash_flow_entries FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_returns_updated      BEFORE UPDATE ON returns           FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_shifts_updated       BEFORE UPDATE ON shifts            FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_stocktakes_updated   BEFORE UPDATE ON stock_takes       FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_pricebooks_updated   BEFORE UPDATE ON price_books       FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_purchord_updated     BEFORE UPDATE ON purchase_orders   FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_purchret_updated     BEFORE UPDATE ON purchase_returns  FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_damage_updated       BEFORE UPDATE ON damage_records    FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_cancel_updated       BEFORE UPDATE ON cancel_reasons    FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_notetpl_updated      BEFORE UPDATE ON note_templates    FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_sectors_updated      BEFORE UPDATE ON processing_sectors FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_printtpl_updated     BEFORE UPDATE ON print_templates   FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_promotions_updated   BEFORE UPDATE ON promotions        FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─── 6. Safe schema additions (idempotent) ───────────────────────────────────
-- Add settings JSONB column if upgrading from an older schema
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}';

-- Add order_type column and make table columns nullable for takeaway/delivery support
ALTER TABLE orders ALTER COLUMN table_id   DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN table_number DROP NOT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS
  order_type VARCHAR(20) NOT NULL DEFAULT 'Dine In'
  CHECK (order_type IN ('Dine In','Takeaway','Delivery'));


-- ─── 7. Seed data ────────────────────────────────────────────────────────────

-- Default restaurant
INSERT INTO restaurants (id, name, slug, status, plan)
VALUES (1, 'Bella Vista', 'bella-vista', 'active', 'pro')
ON CONFLICT (id) DO NOTHING;

SELECT setval('restaurants_id_seq', GREATEST((SELECT MAX(id) FROM restaurants), 1));

-- Default sales channels
INSERT INTO sales_channels (restaurant_id, name, description) VALUES
  (1, 'Dine-in',  'In-restaurant dining'),
  (1, 'Takeaway', 'Customer picks up order'),
  (1, 'Delivery', 'Delivered to customer'),
  (1, 'Online',   'Online order platform')
ON CONFLICT DO NOTHING;

-- Default cancel reasons
INSERT INTO cancel_reasons (restaurant_id, name) VALUES
  (1, 'Customer changed mind'),
  (1, 'Item out of stock'),
  (1, 'Wrong order'),
  (1, 'Long wait time')
ON CONFLICT DO NOTHING;

-- Default note templates
INSERT INTO note_templates (restaurant_id, name, text) VALUES
  (1, 'No spice',       'No spicy ingredients please'),
  (1, 'Extra sauce',    'Extra sauce on the side'),
  (1, 'Allergy note',   'Please check allergens before serving'),
  (1, 'Birthday order', 'Birthday celebration – please add candle')
ON CONFLICT DO NOTHING;

-- Default processing sectors
INSERT INTO processing_sectors (restaurant_id, name, description) VALUES
  (1, 'Main Kitchen',    'Primary food preparation area'),
  (1, 'Bar',             'Beverages and cocktails'),
  (1, 'Dessert Station', 'Desserts and pastries'),
  (1, 'Grill',           'Grilled items')
ON CONFLICT DO NOTHING;

-- ─── 8. Phase 1–3 schema additions ───────────────────────────────────────────

-- system_settings (SMTP config and other persistent settings)
CREATE TABLE IF NOT EXISTS system_settings (
  key        VARCHAR(100) PRIMARY KEY,
  value      TEXT         NOT NULL,
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- order_payments (split/multi-tender payments per order)
CREATE TABLE IF NOT EXISTS order_payments (
  id             SERIAL PRIMARY KEY,
  restaurant_id  INTEGER        REFERENCES restaurants(id) ON DELETE CASCADE,
  order_id       INTEGER        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_method VARCHAR(50)    NOT NULL,
  amount         NUMERIC(10,2)  NOT NULL CHECK (amount > 0),
  currency       VARCHAR(10)    NOT NULL DEFAULT 'LAK',
  cash_tendered  NUMERIC(10,2)  NOT NULL DEFAULT 0,
  change_given   NUMERIC(10,2)  NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- modifier_groups (menu item customisation — Phase 1)
CREATE TABLE IF NOT EXISTS modifier_groups (
  id              SERIAL PRIMARY KEY,
  restaurant_id   INTEGER      NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL,
  selection_type  VARCHAR(10)  NOT NULL DEFAULT 'single'
                    CHECK (selection_type IN ('single','multiple')),
  required        BOOLEAN      NOT NULL DEFAULT FALSE,
  min_selections  INTEGER      NOT NULL DEFAULT 0,
  max_selections  INTEGER      NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS modifier_options (
  id               SERIAL PRIMARY KEY,
  group_id         INTEGER        NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  restaurant_id    INTEGER        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name             VARCHAR(100)   NOT NULL,
  price_adjustment NUMERIC(10,2)  NOT NULL DEFAULT 0,
  available        BOOLEAN        NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS menu_item_modifier_groups (
  menu_item_id      INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  modifier_group_id INTEGER NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (menu_item_id, modifier_group_id)
);

CREATE TABLE IF NOT EXISTS order_item_modifiers (
  id                 SERIAL PRIMARY KEY,
  order_item_id      INTEGER        NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  modifier_option_id INTEGER        NOT NULL REFERENCES modifier_options(id) ON DELETE RESTRICT,
  name               VARCHAR(100)   NOT NULL,
  price_adjustment   NUMERIC(10,2)  NOT NULL DEFAULT 0
);

-- orders — new columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid'
  CHECK (payment_status IN ('unpaid','partial','paid','refunded'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- Update status CHECK to include 'Cancelled'
DO $$ BEGIN
  ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
  ALTER TABLE orders ADD CONSTRAINT orders_status_check
    CHECK (status IN ('Pending','In Progress','Served','Closed','Cancelled'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- order_items — new columns (Phase 1 + 3)
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS notes       TEXT         NOT NULL DEFAULT '';
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS station     VARCHAR(50)  NOT NULL DEFAULT 'Kitchen';
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- menu_items — station + inventory columns (Phase 3 Step 7 + 9)
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS station             VARCHAR(50)    NOT NULL DEFAULT 'Kitchen';
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS stock_quantity      NUMERIC(10,2)  DEFAULT NULL;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS low_stock_threshold NUMERIC(10,2)  NOT NULL DEFAULT 10;

-- menu_items — image support
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT '';

-- shifts — cash reconciliation columns (Phase 3 Step 6)
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS expected_cash NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS cash_variance NUMERIC(10,2) NOT NULL DEFAULT 0;
