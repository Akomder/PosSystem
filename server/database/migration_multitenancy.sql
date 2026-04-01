-- ════════════════════════════════════════════════════════════════════════════
--  Multi-Restaurant Migration
--  Run once: node -e "require('./database/runMigration')"
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Create restaurants table ─────────────────────────────────────────────
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
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── 2. Seed default restaurant (Bella Vista) ─────────────────────────────────
INSERT INTO restaurants (id, name, slug, status, plan)
VALUES (1, 'Bella Vista', 'bella-vista', 'active', 'pro')
ON CONFLICT (id) DO NOTHING;

SELECT setval('restaurants_id_seq', GREATEST((SELECT MAX(id) FROM restaurants), 1));

-- ─── 3. Expand users role to include SuperAdmin ───────────────────────────────
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('SuperAdmin','Admin','Waiter','Cashier'));

-- ─── 4. Add restaurant_id to tenant tables ────────────────────────────────────

-- users
ALTER TABLE users ADD COLUMN IF NOT EXISTS
  restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE SET NULL;
UPDATE users SET restaurant_id = 1 WHERE role != 'SuperAdmin' AND restaurant_id IS NULL;

-- staff
ALTER TABLE staff ADD COLUMN IF NOT EXISTS
  restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE;
UPDATE staff SET restaurant_id = 1 WHERE restaurant_id IS NULL;

-- menu_items
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS
  restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE;
UPDATE menu_items SET restaurant_id = 1 WHERE restaurant_id IS NULL;

-- restaurant_tables: drop global UNIQUE on number, replace with per-restaurant unique
ALTER TABLE restaurant_tables DROP CONSTRAINT IF EXISTS restaurant_tables_number_key;
ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS
  restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE;
UPDATE restaurant_tables SET restaurant_id = 1 WHERE restaurant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tables_num_restaurant
  ON restaurant_tables(number, restaurant_id);

-- orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS
  restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE;
UPDATE orders SET restaurant_id = 1 WHERE restaurant_id IS NULL;

-- order_items (denormalized for perf)
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS
  restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE;
UPDATE order_items SET restaurant_id = 1 WHERE restaurant_id IS NULL;

-- customers (may not exist yet)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='customers') THEN
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS
      restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE;
    UPDATE customers SET restaurant_id = 1 WHERE restaurant_id IS NULL;
  END IF;
END $$;

-- suppliers
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='suppliers') THEN
    ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS
      restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE;
    UPDATE suppliers SET restaurant_id = 1 WHERE restaurant_id IS NULL;
  END IF;
END $$;

-- cash_flow_entries
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='cash_flow_entries') THEN
    ALTER TABLE cash_flow_entries ADD COLUMN IF NOT EXISTS
      restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE;
    UPDATE cash_flow_entries SET restaurant_id = 1 WHERE restaurant_id IS NULL;
  END IF;
END $$;

-- returns
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='returns') THEN
    ALTER TABLE returns ADD COLUMN IF NOT EXISTS
      restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE;
    UPDATE returns SET restaurant_id = 1 WHERE restaurant_id IS NULL;
  END IF;
END $$;

-- return_items
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='return_items') THEN
    ALTER TABLE return_items ADD COLUMN IF NOT EXISTS
      restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE;
    UPDATE return_items SET restaurant_id = 1 WHERE restaurant_id IS NULL;
  END IF;
END $$;

-- ─── 5. Additional payment columns on orders (idempotent) ────────────────────
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount        NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method  VARCHAR(50)   NOT NULL DEFAULT 'cash';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency        VARCHAR(10)   NOT NULL DEFAULT 'LAK';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS voucher_code    VARCHAR(100)  NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cash_tendered   NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS change_amount   NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id     INTEGER REFERENCES customers(id) ON DELETE SET NULL;

-- ─── 6. Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_restaurants_status  ON restaurants(status);
CREATE INDEX IF NOT EXISTS idx_users_restaurant    ON users(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_staff_restaurant    ON staff(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_restaurant     ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_tables_restaurant   ON restaurant_tables(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant   ON orders(restaurant_id);

-- ─── 7. Auto-update trigger for restaurants ───────────────────────────────────
DO $$ BEGIN
  CREATE TRIGGER trg_restaurants_updated
    BEFORE UPDATE ON restaurants
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
