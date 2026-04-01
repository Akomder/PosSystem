-- ════════════════════════════════════════════════════════════════════════════
--  Bella Vista POS — PostgreSQL 16 Schema
-- ════════════════════════════════════════════════════════════════════════════

-- ─── USERS (authentication credentials) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20)  NOT NULL CHECK (role IN ('Admin','Waiter','Cashier')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── STAFF (profile — linked to users) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name             VARCHAR(100) NOT NULL,
  role             VARCHAR(20)  NOT NULL CHECK (role IN ('Admin','Waiter','Cashier')),
  avatar           VARCHAR(500),
  tables_assigned  INTEGER[]    NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── MENU ITEMS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu_items (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(150)   NOT NULL,
  category    VARCHAR(30)    NOT NULL CHECK (category IN ('Starters','Mains','Drinks','Desserts')),
  price       NUMERIC(10,2)  NOT NULL CHECK (price > 0),
  description TEXT           NOT NULL DEFAULT '',
  available   BOOLEAN        NOT NULL DEFAULT TRUE,
  stock       INTEGER        NOT NULL DEFAULT 0 CHECK (stock >= 0),
  tags        TEXT[]         NOT NULL DEFAULT '{}',
  prep_time   INTEGER        NOT NULL DEFAULT 10 CHECK (prep_time >= 0),
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ─── RESTAURANT TABLES ───────────────────────────────────────────────────────
-- Named "restaurant_tables" to avoid PostgreSQL's reserved word "tables"
CREATE TABLE IF NOT EXISTS restaurant_tables (
  id               SERIAL PRIMARY KEY,
  number           INTEGER      NOT NULL UNIQUE,
  capacity         INTEGER      NOT NULL CHECK (capacity > 0),
  status           VARCHAR(20)  NOT NULL DEFAULT 'Available'
                     CHECK (status IN ('Available','Occupied','Reserved')),
  waiter           VARCHAR(100),
  current_order_id INTEGER,          -- FK added below (circular dep)
  section          VARCHAR(30)  NOT NULL CHECK (section IN ('Main Hall','Terrace','Private')),
  position_row     INTEGER      NOT NULL DEFAULT 0,
  position_col     INTEGER      NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── ORDERS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id           SERIAL PRIMARY KEY,
  table_id     INTEGER        NOT NULL REFERENCES restaurant_tables(id) ON DELETE RESTRICT,
  table_number INTEGER        NOT NULL,
  waiter       VARCHAR(100)   NOT NULL DEFAULT 'Unassigned',
  status       VARCHAR(20)    NOT NULL DEFAULT 'Pending'
                 CHECK (status IN ('Pending','In Progress','Served','Closed')),
  subtotal     NUMERIC(10,2)  NOT NULL DEFAULT 0,
  tax          NUMERIC(10,2)  NOT NULL DEFAULT 0,
  total        NUMERIC(10,2)  NOT NULL DEFAULT 0,
  notes        TEXT           NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ─── ORDER ITEMS (line items) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id            SERIAL PRIMARY KEY,
  order_id      INTEGER        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id  INTEGER        NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
  name          VARCHAR(150)   NOT NULL,    -- snapshot at order time
  quantity      INTEGER        NOT NULL CHECK (quantity > 0),
  unit_price    NUMERIC(10,2)  NOT NULL CHECK (unit_price > 0),
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ─── DEFERRED FK: restaurant_tables.current_order_id → orders ───────────────
ALTER TABLE restaurant_tables
  ADD CONSTRAINT fk_current_order
  FOREIGN KEY (current_order_id) REFERENCES orders(id) ON DELETE SET NULL;

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_status    ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_table_id  ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_created   ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_ord  ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_menu_category    ON menu_items(category);
CREATE INDEX IF NOT EXISTS idx_menu_available   ON menu_items(available);
CREATE INDEX IF NOT EXISTS idx_staff_user       ON staff(user_id);

-- ─── auto-update updated_at columns ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_users_updated   BEFORE UPDATE ON users            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_staff_updated   BEFORE UPDATE ON staff            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_menu_updated    BEFORE UPDATE ON menu_items       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_tables_updated  BEFORE UPDATE ON restaurant_tables FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_orders_updated  BEFORE UPDATE ON orders           FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
