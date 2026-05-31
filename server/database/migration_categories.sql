-- ─── Adjustable Menu Categories ───────────────────────────────────────────────
-- Run once against your Supabase Postgres instance.

-- 1. New table — one row per category per restaurant
CREATE TABLE IF NOT EXISTS menu_categories (
  id            SERIAL       PRIMARY KEY,
  restaurant_id INTEGER      NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name          VARCHAR(50)  NOT NULL,
  sort_order    INTEGER      NOT NULL DEFAULT 0,
  color         VARCHAR(20)  NOT NULL DEFAULT '#14b8a6',
  UNIQUE (restaurant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_menu_categories_restaurant
  ON menu_categories(restaurant_id, sort_order);

-- 2. Seed the four defaults for every existing restaurant
INSERT INTO menu_categories (restaurant_id, name, sort_order, color)
SELECT id, 'Starters', 0, '#f97316' FROM restaurants ON CONFLICT DO NOTHING;
INSERT INTO menu_categories (restaurant_id, name, sort_order, color)
SELECT id, 'Mains',    1, '#14b8a6' FROM restaurants ON CONFLICT DO NOTHING;
INSERT INTO menu_categories (restaurant_id, name, sort_order, color)
SELECT id, 'Drinks',   2, '#3b82f6' FROM restaurants ON CONFLICT DO NOTHING;
INSERT INTO menu_categories (restaurant_id, name, sort_order, color)
SELECT id, 'Desserts', 3, '#ec4899' FROM restaurants ON CONFLICT DO NOTHING;

-- 3. Drop the hard-coded CHECK constraint so any custom name is accepted
ALTER TABLE menu_items DROP CONSTRAINT IF EXISTS menu_items_category_check;

-- 4. Widen the column to match the new table
ALTER TABLE menu_items ALTER COLUMN category TYPE VARCHAR(50);
