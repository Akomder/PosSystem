require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const bcrypt = require('bcryptjs')
const { pool } = require('../src/config/db')

const SALT_ROUNDS = 10
const TAX_RATE = parseFloat(process.env.TAX_RATE) || 0.10

// ── Menu items (matches frontend mockMenu.js) ─────────────────────────────────
const MENU_ITEMS = [
  { name: 'Caesar Salad',     category: 'Starters', price: 12.50, description: 'Romaine lettuce, parmesan, croutons, classic Caesar dressing', available: true,  stock: 20, tags: ['vegetarian'],           prep_time: 8  },
  { name: 'Tomato Soup',      category: 'Starters', price: 8.50,  description: 'Creamy heirloom tomato soup with fresh basil and croutons',      available: true,  stock: 15, tags: ['vegetarian','vegan'],   prep_time: 10 },
  { name: 'Bruschetta',       category: 'Starters', price: 9.00,  description: 'Toasted baguette with tomatoes, garlic, basil, and olive oil',   available: true,  stock: 18, tags: ['vegetarian'],           prep_time: 6  },
  { name: 'Caprese Salad',    category: 'Starters', price: 11.00, description: 'Fresh mozzarella, heirloom tomatoes, basil, balsamic glaze',     available: true,  stock: 12, tags: ['vegetarian'],           prep_time: 5  },
  { name: 'Onion Soup',       category: 'Starters', price: 9.00,  description: 'Classic French onion soup with gruyere cheese crust',            available: true,  stock: 10, tags: [],                       prep_time: 15 },
  { name: 'Shrimp Cocktail',  category: 'Starters', price: 15.00, description: 'Chilled jumbo shrimp with cocktail sauce and lemon',             available: true,  stock: 8,  tags: ['gluten-free'],          prep_time: 5  },
  { name: 'Garlic Bread',     category: 'Starters', price: 6.00,  description: 'Toasted sourdough with garlic butter and herbs',                 available: false, stock: 0,  tags: ['vegetarian'],           prep_time: 7  },
  { name: 'Margherita Pizza', category: 'Mains',    price: 18.00, description: 'Classic wood-fired pizza with tomato sauce, mozzarella, basil',  available: true,  stock: 15, tags: ['vegetarian'],           prep_time: 20 },
  { name: 'Grilled Salmon',   category: 'Mains',    price: 24.00, description: 'Atlantic salmon fillet with lemon butter sauce and asparagus',   available: true,  stock: 10, tags: ['gluten-free'],          prep_time: 18 },
  { name: 'Pasta Carbonara',  category: 'Mains',    price: 16.50, description: 'Spaghetti with pancetta, egg, parmesan, and black pepper',        available: true,  stock: 14, tags: [],                       prep_time: 15 },
  { name: 'Beef Tenderloin',  category: 'Mains',    price: 34.00, description: '8oz tenderloin with truffle mashed potato and red wine jus',      available: true,  stock: 6,  tags: ['gluten-free'],          prep_time: 25 },
  { name: 'Rack of Lamb',     category: 'Mains',    price: 38.00, description: 'Herb-crusted rack of lamb with roasted vegetables and mint sauce', available: true,  stock: 4,  tags: [],                       prep_time: 30 },
  { name: 'Chicken Breast',   category: 'Mains',    price: 22.00, description: 'Pan-seared chicken with mushroom cream sauce and vegetables',      available: true,  stock: 12, tags: ['gluten-free'],          prep_time: 20 },
  { name: 'Seafood Risotto',  category: 'Mains',    price: 26.00, description: 'Creamy arborio rice with shrimp, scallops, and saffron broth',    available: true,  stock: 8,  tags: ['gluten-free'],          prep_time: 22 },
  { name: 'Veggie Burger',    category: 'Mains',    price: 14.00, description: 'Black bean and quinoa patty with avocado and chipotle mayo',      available: true,  stock: 10, tags: ['vegetarian','vegan'],   prep_time: 15 },
  { name: 'Fish & Chips',     category: 'Mains',    price: 19.00, description: 'Beer-battered cod with twice-cooked chips and tartare sauce',     available: true,  stock: 9,  tags: [],                       prep_time: 18 },
  { name: 'Sparkling Water',  category: 'Drinks',   price: 3.50,  description: 'Premium sparkling mineral water (500ml)',                          available: true,  stock: 50, tags: ['vegan','gluten-free'],  prep_time: 1  },
  { name: 'Lemonade',         category: 'Drinks',   price: 4.50,  description: 'Freshly squeezed lemonade with mint and honey',                   available: true,  stock: 30, tags: ['vegan','gluten-free'],  prep_time: 3  },
  { name: 'Red Wine',         category: 'Drinks',   price: 12.00, description: 'House Cabernet Sauvignon — bold, full-bodied (glass)',             available: true,  stock: 25, tags: ['vegan','gluten-free'],  prep_time: 1  },
  { name: 'White Wine',       category: 'Drinks',   price: 11.00, description: 'House Chardonnay — crisp and buttery (glass)',                    available: true,  stock: 22, tags: ['vegan','gluten-free'],  prep_time: 1  },
  { name: 'Espresso',         category: 'Drinks',   price: 3.50,  description: 'Double shot espresso from single-origin Colombian beans',          available: true,  stock: 40, tags: ['vegan','gluten-free'],  prep_time: 2  },
  { name: 'Craft Beer',       category: 'Drinks',   price: 7.00,  description: 'Local craft IPA on tap (pint)',                                   available: true,  stock: 18, tags: ['gluten-free'],          prep_time: 1  },
  { name: 'Tiramisu',         category: 'Desserts', price: 8.00,  description: 'Classic Italian tiramisu with espresso-soaked ladyfingers',        available: true,  stock: 12, tags: ['vegetarian'],           prep_time: 5  },
  { name: 'Chocolate Mousse', category: 'Desserts', price: 7.50,  description: 'Dark chocolate mousse with raspberry coulis and whipped cream',    available: true,  stock: 10, tags: ['vegetarian'],           prep_time: 5  },
  { name: 'Creme Brulee',     category: 'Desserts', price: 8.50,  description: 'Vanilla bean custard with a caramelised sugar crust',              available: true,  stock: 8,  tags: ['vegetarian','gluten-free'], prep_time: 5 },
  { name: 'Lemon Tart',       category: 'Desserts', price: 7.00,  description: 'Buttery pastry shell with tangy lemon curd and fresh berries',    available: true,  stock: 6,  tags: ['vegetarian'],           prep_time: 5  },
]

// ── Tables ────────────────────────────────────────────────────────────────────
const TABLES = [
  { number: 1,  capacity: 2, status: 'Reserved',  waiter: null,            section: 'Main Hall', position_row: 0, position_col: 0 },
  { number: 2,  capacity: 4, status: 'Occupied',  waiter: 'Emily Chen',    section: 'Main Hall', position_row: 0, position_col: 1 },
  { number: 3,  capacity: 4, status: 'Occupied',  waiter: 'Sophie Martin', section: 'Main Hall', position_row: 0, position_col: 2 },
  { number: 4,  capacity: 6, status: 'Reserved',  waiter: null,            section: 'Main Hall', position_row: 0, position_col: 3 },
  { number: 5,  capacity: 4, status: 'Occupied',  waiter: 'Sophie Martin', section: 'Main Hall', position_row: 0, position_col: 4 },
  { number: 6,  capacity: 2, status: 'Occupied',  waiter: 'James Wilson',  section: 'Main Hall', position_row: 1, position_col: 0 },
  { number: 7,  capacity: 4, status: 'Occupied',  waiter: 'James Wilson',  section: 'Main Hall', position_row: 1, position_col: 1 },
  { number: 8,  capacity: 8, status: 'Available', waiter: null,            section: 'Main Hall', position_row: 1, position_col: 2 },
  { number: 9,  capacity: 4, status: 'Available', waiter: null,            section: 'Main Hall', position_row: 1, position_col: 3 },
  { number: 10, capacity: 6, status: 'Reserved',  waiter: null,            section: 'Main Hall', position_row: 1, position_col: 4 },
  { number: 11, capacity: 2, status: 'Occupied',  waiter: 'Sophie Martin', section: 'Terrace',   position_row: 2, position_col: 0 },
  { number: 12, capacity: 4, status: 'Occupied',  waiter: 'Emily Chen',    section: 'Terrace',   position_row: 2, position_col: 1 },
  { number: 13, capacity: 4, status: 'Available', waiter: null,            section: 'Terrace',   position_row: 2, position_col: 2 },
  { number: 14, capacity: 6, status: 'Occupied',  waiter: 'James Wilson',  section: 'Terrace',   position_row: 2, position_col: 3 },
  { number: 15, capacity: 2, status: 'Available', waiter: null,            section: 'Terrace',   position_row: 2, position_col: 4 },
  { number: 16, capacity: 4, status: 'Occupied',  waiter: 'Marcus Lee',    section: 'Terrace',   position_row: 3, position_col: 0 },
  { number: 17, capacity: 8, status: 'Reserved',  waiter: null,            section: 'Private',   position_row: 3, position_col: 1 },
  { number: 18, capacity: 4, status: 'Occupied',  waiter: 'Emily Chen',    section: 'Private',   position_row: 3, position_col: 2 },
  { number: 19, capacity: 6, status: 'Reserved',  waiter: null,            section: 'Private',   position_row: 3, position_col: 3 },
  { number: 20, capacity: 2, status: 'Available', waiter: null,            section: 'Private',   position_row: 3, position_col: 4 },
]

// ── Order + items seed data ───────────────────────────────────────────────────
// Items use 1-based menu_item index (position in MENU_ITEMS array + 1 after insert)
const ORDER_SEEDS = [
  { tableNum: 3,  waiter: 'Sophie Martin', status: 'In Progress', notes: 'Allergy: nuts',
    items: [{name:'Caesar Salad',qty:2,price:12.50},{name:'Grilled Salmon',qty:1,price:24.00},{name:'Sparkling Water',qty:3,price:3.50}] },
  { tableNum: 7,  waiter: 'James Wilson',  status: 'Pending',     notes: '',
    items: [{name:'Bruschetta',qty:1,price:9.00},{name:'Beef Tenderloin',qty:2,price:34.00},{name:'Red Wine',qty:2,price:12.00}] },
  { tableNum: 12, waiter: 'Emily Chen',    status: 'Served',      notes: 'Extra cheese on pizza',
    items: [{name:'Tomato Soup',qty:2,price:8.50},{name:'Margherita Pizza',qty:1,price:18.00},{name:'Tiramisu',qty:2,price:8.00}] },
  { tableNum: 5,  waiter: 'Sophie Martin', status: 'In Progress', notes: '',
    items: [{name:'Caprese Salad',qty:1,price:11.00},{name:'Pasta Carbonara',qty:2,price:16.50},{name:'Lemonade',qty:2,price:4.50}] },
  { tableNum: 11, waiter: 'Sophie Martin', status: 'Pending',     notes: '',
    items: [{name:'Bruschetta',qty:2,price:9.00},{name:'Fish & Chips',qty:1,price:19.00},{name:'Sparkling Water',qty:2,price:3.50}] },
  { tableNum: 14, waiter: 'James Wilson',  status: 'Pending',     notes: 'One chicken well done',
    items: [{name:'Onion Soup',qty:3,price:9.00},{name:'Chicken Breast',qty:3,price:22.00}] },
  { tableNum: 2,  waiter: 'Emily Chen',    status: 'In Progress', notes: '',
    items: [{name:'Caesar Salad',qty:1,price:12.50},{name:'Seafood Risotto',qty:2,price:26.00},{name:'Espresso',qty:2,price:3.50}] },
  { tableNum: 16, waiter: 'Marcus Lee',    status: 'Served',      notes: 'Vegan patty',
    items: [{name:'Garlic Bread',qty:2,price:6.00},{name:'Veggie Burger',qty:2,price:14.00},{name:'Chocolate Mousse',qty:2,price:7.50}] },
  { tableNum: 6,  waiter: 'James Wilson',  status: 'In Progress', notes: 'Birthday dinner',
    items: [{name:'Caprese Salad',qty:2,price:11.00},{name:'Grilled Salmon',qty:2,price:24.00},{name:'Creme Brulee',qty:2,price:8.50}] },
  { tableNum: 18, waiter: 'Emily Chen',    status: 'Served',      notes: '',
    items: [{name:'Beef Tenderloin',qty:1,price:34.00},{name:'Red Wine',qty:2,price:12.00}] },
]

// ── Helpers ──────────────────────────────────────────────────────────────────
function calcOrder(items) {
  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0)
  const tax      = Math.round(subtotal * TAX_RATE * 100) / 100
  const total    = Math.round((subtotal + tax) * 100) / 100
  return { subtotal, tax, total }
}

// ── Main seed function ────────────────────────────────────────────────────────
async function seed() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    console.log('🌱 Seeding database...')

    // 1. Truncate in reverse FK order
    await client.query('UPDATE restaurant_tables SET current_order_id = NULL')
    await client.query('TRUNCATE order_items, orders, restaurant_tables, menu_items, staff, users RESTART IDENTITY CASCADE')
    console.log('  ✓ Cleared existing data')

    // 2. Users
    const [adminHash, waiterHash, cashierHash] = await Promise.all([
      bcrypt.hash('admin123',   SALT_ROUNDS),
      bcrypt.hash('waiter123',  SALT_ROUNDS),
      bcrypt.hash('cashier123', SALT_ROUNDS),
    ])
    const usersRes = await client.query(`
      INSERT INTO users (email, password_hash, role) VALUES
        ('admin@pos.com',   $1, 'Admin'),
        ('waiter@pos.com',  $2, 'Waiter'),
        ('cashier@pos.com', $3, 'Cashier')
      RETURNING id
    `, [adminHash, waiterHash, cashierHash])
    const [adminId, waiterId, cashierId] = usersRes.rows.map(r => r.id)
    console.log('  ✓ Users inserted')

    // 3. Menu items
    const menuIds = {}
    for (const item of MENU_ITEMS) {
      const r = await client.query(`
        INSERT INTO menu_items (name, category, price, description, available, stock, tags, prep_time)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id
      `, [item.name, item.category, item.price, item.description, item.available, item.stock, item.tags, item.prep_time])
      menuIds[item.name] = r.rows[0].id
    }
    console.log('  ✓ Menu items inserted')

    // 4. Restaurant tables (without current_order_id yet)
    const tableIds = {}  // number → db id
    for (const t of TABLES) {
      const r = await client.query(`
        INSERT INTO restaurant_tables (number, capacity, status, waiter, section, position_row, position_col)
        VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id
      `, [t.number, t.capacity, t.status, t.waiter, t.section, t.position_row, t.position_col])
      tableIds[t.number] = r.rows[0].id
    }
    console.log('  ✓ Tables inserted')

    // 5. Orders + order_items
    for (const o of ORDER_SEEDS) {
      const tableDbId = tableIds[o.tableNum]
      const { subtotal, tax, total } = calcOrder(o.items)
      const ordRes = await client.query(`
        INSERT INTO orders (table_id, table_number, waiter, status, subtotal, tax, total, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id
      `, [tableDbId, o.tableNum, o.waiter, o.status, subtotal, tax, total, o.notes])
      const ordId = ordRes.rows[0].id

      for (const item of o.items) {
        const miId = menuIds[item.name]
        if (!miId) throw new Error(`Menu item not found: ${item.name}`)
        await client.query(`
          INSERT INTO order_items (order_id, menu_item_id, name, quantity, unit_price)
          VALUES ($1,$2,$3,$4,$5)
        `, [ordId, miId, item.name, item.qty, item.price])
      }

      // Link occupied tables to their order
      const tableStatus = TABLES.find(t => t.number === o.tableNum)?.status
      if (['Occupied','Served'].includes(tableStatus)) {
        await client.query(
          'UPDATE restaurant_tables SET current_order_id=$1 WHERE id=$2',
          [ordId, tableDbId]
        )
      }
    }
    console.log('  ✓ Orders + order items inserted')

    // 6. Staff
    await client.query(`
      INSERT INTO staff (user_id, name, role, tables_assigned) VALUES
        ($1, 'Sophie Martin', 'Waiter',  '{3,5,11}'),
        (NULL,'James Wilson',  'Waiter',  '{6,7,14}'),
        ($2, 'Emily Chen',    'Waiter',  '{2,12,18}'),
        (NULL,'Marcus Lee',    'Waiter',  '{16}'),
        ($3, 'Sarah Kim',     'Cashier', '{}'),
        ($1, 'David Brown',   'Admin',   '{}')
    `, [waiterId, waiterId, cashierId])
    // Fix: admin user is linked to adminId
    await client.query(`UPDATE staff SET user_id=$1 WHERE name='David Brown'`, [adminId])
    console.log('  ✓ Staff inserted')

    await client.query('COMMIT')
    console.log('\n✅ Database seeded successfully!')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌ Seed failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

seed()
