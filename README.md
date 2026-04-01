# Restaurant POS System

A full-featured Point of Sale management system designed for restaurants. Handles everything from table reservations and order taking to inventory tracking and sales reporting.

---

## Features

### Order Management
- Create, update, and close customer orders in real time
- Split bills, apply discounts, and process multiple payment methods (cash, card, mobile)
- Send orders directly to the kitchen display or printer
- Track order status: Pending → In Progress → Served → Closed

### Table Management
- Interactive floor plan with live table status (Available, Occupied, Reserved)
- Assign and reassign waitstaff to tables
- Manage reservations and walk-in seating
- Merge or split tables for large parties

### Menu Management
- Organize items by categories (Starters, Mains, Drinks, Desserts)
- Set prices, descriptions, images, and dietary tags (vegan, gluten-free, etc.)
- Mark items as available or 86'd (out of stock) instantly
- Support for modifiers and add-ons (e.g., extra toppings, cooking preferences)

### Inventory & Reports
- Track ingredient stock levels with low-stock alerts
- Auto-deduct inventory on order completion
- Daily, weekly, and monthly sales reports
- Top-selling items, peak hours, and revenue analytics dashboard
- Export reports to CSV or PDF

---

## Tech Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Frontend    | React 18, React Router, Tailwind CSS |
| Backend     | Node.js, Express.js               |
| Database    | MySQL / PostgreSQL                 |
| Auth        | JSON Web Tokens (JWT)             |
| Real-time   | Socket.IO (kitchen display sync)  |
| Testing     | Jest, React Testing Library        |

---

## Project Structure

```
PosSystem/
├── client/                  # React frontend
│   ├── public/
│   └── src/
│       ├── components/      # Reusable UI components
│       ├── pages/           # Route-level pages
│       ├── hooks/           # Custom React hooks
│       ├── context/         # Global state (auth, cart)
│       └── services/        # API call helpers
├── server/                  # Node.js backend
│   ├── controllers/         # Request handlers
│   ├── routes/              # Express route definitions
│   ├── models/              # Database models / queries
│   ├── middleware/          # Auth, error handling
│   └── config/              # DB connection, env config
├── database/
│   └── schema.sql           # Table definitions & seed data
├── .env.example
├── package.json
└── README.md
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [npm](https://www.npmjs.com/) v9+ or [yarn](https://yarnpkg.com/)
- MySQL 8+ or PostgreSQL 14+

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/restaurant-pos.git
   cd restaurant-pos/PosSystem
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials and JWT secret
   ```

3. **Install dependencies**
   ```bash
   # Install backend dependencies
   cd server && npm install

   # Install frontend dependencies
   cd ../client && npm install
   ```

4. **Set up the database**
   ```bash
   # Create the database and run the schema
   mysql -u root -p < database/schema.sql
   # or for PostgreSQL:
   psql -U postgres -f database/schema.sql
   ```

### Running the App

```bash
# Start the backend server (from /server)
npm run dev          # runs on http://localhost:5000

# Start the frontend (from /client)
npm start            # runs on http://localhost:3000
```

Visit `http://localhost:3000` in your browser to access the POS system.

---

## API Overview

| Method | Endpoint                  | Description                  |
|--------|---------------------------|------------------------------|
| POST   | `/api/auth/login`         | Authenticate user            |
| GET    | `/api/tables`             | List all tables              |
| POST   | `/api/orders`             | Create a new order           |
| PUT    | `/api/orders/:id`         | Update order items or status |
| GET    | `/api/menu`               | Get full menu                |
| POST   | `/api/menu/items`         | Add a menu item              |
| GET    | `/api/reports/sales`      | Get sales report             |
| GET    | `/api/inventory`          | List inventory items         |

> Full API documentation available via [Swagger UI](http://localhost:5000/api-docs) when running locally.

---

## Screenshots

> _Screenshots will be added as the UI is built out._

| Dashboard | Order View | Table Map |
|-----------|------------|-----------|
| _(coming soon)_ | _(coming soon)_ | _(coming soon)_ |

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Open a Pull Request

Please follow the [Conventional Commits](https://www.conventionalcommits.org/) specification for commit messages.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

> Built with care for restaurant operators who need a fast, reliable, and easy-to-use POS solution.
