export const mockMenuItems = [
  // Starters (6)
  { id: 'MI-001', name: 'Caesar Salad',     category: 'Starters', price: 12.50, description: 'Romaine lettuce, parmesan, croutons, classic Caesar dressing', available: true,  stock: 20, tags: ['vegetarian'],          prepTime: 8  },
  { id: 'MI-002', name: 'Tomato Soup',      category: 'Starters', price: 8.50,  description: 'Creamy heirloom tomato soup with fresh basil and croutons',      available: true,  stock: 15, tags: ['vegetarian', 'vegan'],  prepTime: 10 },
  { id: 'MI-003', name: 'Bruschetta',       category: 'Starters', price: 9.00,  description: 'Toasted baguette with tomatoes, garlic, basil, and olive oil',   available: true,  stock: 18, tags: ['vegetarian'],          prepTime: 6  },
  { id: 'MI-004', name: 'Caprese Salad',    category: 'Starters', price: 11.00, description: 'Fresh mozzarella, heirloom tomatoes, basil, balsamic glaze',     available: true,  stock: 12, tags: ['vegetarian'],          prepTime: 5  },
  { id: 'MI-005', name: 'Onion Soup',       category: 'Starters', price: 9.00,  description: 'Classic French onion soup with gruyere cheese crust',            available: true,  stock: 10, tags: [],                     prepTime: 15 },
  { id: 'MI-006', name: 'Shrimp Cocktail',  category: 'Starters', price: 15.00, description: 'Chilled jumbo shrimp with cocktail sauce and lemon',             available: true,  stock: 8,  tags: ['gluten-free'],         prepTime: 5  },
  { id: 'MI-007', name: 'Garlic Bread',     category: 'Starters', price: 6.00,  description: 'Toasted sourdough with garlic butter and herbs',                 available: false, stock: 0,  tags: ['vegetarian'],          prepTime: 7  },

  // Mains (8)
  { id: 'MI-008', name: 'Margherita Pizza',  category: 'Mains', price: 18.00, description: 'Classic wood-fired pizza with tomato sauce, mozzarella, and basil',     available: true, stock: 15, tags: ['vegetarian'],         prepTime: 20 },
  { id: 'MI-009', name: 'Grilled Salmon',    category: 'Mains', price: 24.00, description: 'Atlantic salmon fillet with lemon butter sauce and asparagus',           available: true, stock: 10, tags: ['gluten-free'],        prepTime: 18 },
  { id: 'MI-010', name: 'Pasta Carbonara',   category: 'Mains', price: 16.50, description: 'Spaghetti with pancetta, egg, parmesan, and black pepper',              available: true, stock: 14, tags: [],                    prepTime: 15 },
  { id: 'MI-011', name: 'Beef Tenderloin',   category: 'Mains', price: 34.00, description: '8oz tenderloin with truffle mashed potato and red wine jus',            available: true, stock: 6,  tags: ['gluten-free'],        prepTime: 25 },
  { id: 'MI-012', name: 'Rack of Lamb',      category: 'Mains', price: 38.00, description: 'Herb-crusted rack of lamb with roasted vegetables and mint sauce',      available: true, stock: 4,  tags: [],                    prepTime: 30 },
  { id: 'MI-013', name: 'Chicken Breast',    category: 'Mains', price: 22.00, description: 'Pan-seared chicken with mushroom cream sauce and seasonal vegetables',  available: true, stock: 12, tags: ['gluten-free'],        prepTime: 20 },
  { id: 'MI-014', name: 'Seafood Risotto',   category: 'Mains', price: 26.00, description: 'Creamy arborio rice with shrimp, scallops, and saffron broth',         available: true, stock: 8,  tags: ['gluten-free'],        prepTime: 22 },
  { id: 'MI-015', name: 'Veggie Burger',     category: 'Mains', price: 14.00, description: 'Black bean and quinoa patty with avocado, tomato, and chipotle mayo',  available: true, stock: 10, tags: ['vegetarian', 'vegan'], prepTime: 15 },
  { id: 'MI-016', name: 'Fish & Chips',      category: 'Mains', price: 19.00, description: 'Beer-battered cod with twice-cooked chips and tartare sauce',          available: true, stock: 9,  tags: [],                    prepTime: 18 },

  // Drinks (6)
  { id: 'MI-017', name: 'Sparkling Water', category: 'Drinks', price: 3.50,  description: 'Premium sparkling mineral water (500ml)',                   available: true, stock: 50, tags: ['vegan', 'gluten-free'], prepTime: 1 },
  { id: 'MI-018', name: 'Lemonade',        category: 'Drinks', price: 4.50,  description: 'Freshly squeezed lemonade with mint and honey',             available: true, stock: 30, tags: ['vegan', 'gluten-free'], prepTime: 3 },
  { id: 'MI-019', name: 'Red Wine',        category: 'Drinks', price: 12.00, description: 'House Cabernet Sauvignon — bold, full-bodied (glass)',       available: true, stock: 25, tags: ['vegan', 'gluten-free'], prepTime: 1 },
  { id: 'MI-020', name: 'White Wine',      category: 'Drinks', price: 11.00, description: 'House Chardonnay — crisp and buttery (glass)',              available: true, stock: 22, tags: ['vegan', 'gluten-free'], prepTime: 1 },
  { id: 'MI-021', name: 'Espresso',        category: 'Drinks', price: 3.50,  description: 'Double shot espresso from single-origin Colombian beans',   available: true, stock: 40, tags: ['vegan', 'gluten-free'], prepTime: 2 },
  { id: 'MI-022_d', name: 'Craft Beer',   category: 'Drinks', price: 7.00,  description: 'Local craft IPA on tap (pint)',                             available: true, stock: 18, tags: ['gluten-free'],          prepTime: 1 },

  // Desserts (4)
  { id: 'MI-022', name: 'Tiramisu',         category: 'Desserts', price: 8.00,  description: 'Classic Italian tiramisu with espresso-soaked ladyfingers and mascarpone', available: true, stock: 12, tags: ['vegetarian'], prepTime: 5 },
  { id: 'MI-023', name: 'Chocolate Mousse', category: 'Desserts', price: 7.50,  description: 'Dark chocolate mousse with raspberry coulis and whipped cream',            available: true, stock: 10, tags: ['vegetarian'], prepTime: 5 },
  { id: 'MI-024', name: 'Creme Brulee',     category: 'Desserts', price: 8.50,  description: 'Vanilla bean custard with a caramelised sugar crust',                     available: true, stock: 8,  tags: ['vegetarian', 'gluten-free'], prepTime: 5 },
  { id: 'MI-025', name: 'Lemon Tart',       category: 'Desserts', price: 7.00,  description: 'Buttery pastry shell with tangy lemon curd and fresh berries',            available: true, stock: 6,  tags: ['vegetarian'], prepTime: 5 },
]
