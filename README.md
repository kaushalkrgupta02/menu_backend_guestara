# Guestara – Menu & Services Management Backend

[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)](https://www.prisma.io/)
[![Express](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

A Node.js/Express backend for managing restaurant menus, services, pricing, bookings, and add-ons with PostgreSQL. Built with TypeScript and Clean Architecture principles for scalability, type safety, and maintainability.

## Tech Stack

| Technology         | Purpose          | Why Selected                                                                 |
|:-------------------|:-----------------|:---------------------------------------------------------------------------|
| **Node.js (v20+)** | Core Runtime     | High-performance, modern runtime for production APIs.                      |
| **TypeScript**     | Type Safety      | Catch errors at compile-time, improved DX with interfaces and generics.    |
| **Express (v5)**   | Web Framework    | Lightweight, fast, industry-standard with excellent middleware ecosystem.   |
| **PostgreSQL**     | Primary Database | ACID compliance for bookings + JSONB for flexible pricing configs.          |
| **Prisma ORM**     | Data Access      | Type-safe queries, automatic migrations, relationship handling.            |
| **Zod**            | Validation       | Runtime schema validation integrated with TypeScript.                      |
| **Docker**         | Containerization | Consistent development and deployment environments.                        |

## Project Structure

```
├── app.ts                      # Express app entry point
├── config/
│   ├── db_conn.ts              # Database connection pool
│   └── prisma_client.ts        # Prisma client singleton
├── controllers/                # HTTP request handlers
│   ├── itemController.ts       # Item CRUD & pricing
│   ├── bookingController.ts    # Booking management
│   ├── addonController.ts      # Add-ons management
│   ├── categoryController.ts   # Categories
│   └── subcategoryController.ts
├── dto/
│   └── formatters.ts           # Common response DTOs
├── docs/
│   └── swagger.ts              # OpenAPI/Swagger documentation
├── middleware/                 # Express middleware
│   └── errorHandler.ts         # Centralized error handling
├── prisma/
│   ├── migrations/             # Database migrations
│   ├── prisma.config.ts        # Prisma config
│   ├── schema.prisma           # Database schema (enums, models)
│   └── seed.ts                 # Database seeding script
├── routes/                     # API route definitions
├── services/                   # Business logic
│   ├── price_engine.ts         # Pricing calculation engine
│   ├── price_config.ts         # Pricing config validation
│   └── tax.service.ts          # Tax calculation service
├── utils/                      # Helper utilities
│   ├── decimal.ts              # Decimal utilities
│   ├── errors.ts               # Custom error classes
│   ├── time.ts                 # Time utilities
│   └── visibility.ts           # Item visibility logic
├── validations/                # Zod validation schemas
├── docker-compose.yml          # Docker Compose config
├── Dockerfile                  # Docker image definition
├── package.json                # Project metadata & scripts
├── README.md                   # Project documentation
└── tsconfig.json               # TypeScript config
```

---

### price_config() Payloads

| Pricing Type   | Code | Example Payload |
|---------------|------|----------------|
| STATIC        | A    | `{ "base_price": 300 }` |
| TIERED        | B    | `{ "tiers": [{ "upto": 1, "price": 300 }, { "upto": 2, "price": 500 }] }` |
| COMPLIMENTARY | C    | `{}` |
| DISCOUNTED    | D    | `{ "val": 10, "is_perc": true }` |
| DYNAMIC       | E    | `{ "windows": [{ "start": "08:00", "end": "11:00", "price": 199 }] }` |

**Payload Details:**
- **STATIC (A):** Only `base_price` is required.
- **TIERED (B):** `tiers` is an array of `{ upto, price }` objects for quantity/duration-based pricing.
- **COMPLIMENTARY (C):** No fields required (empty object).
- **DISCOUNTED (D):** `val` is the discount value, `is_perc` indicates if it's a percentage.
- **DYNAMIC (E):** `windows` is an array of time windows with specific prices.

---

## Database Schema
![Database Schema Diagram](./docs/localhost_db_schema_final11.jpg)


### Key Tables

1. **Category** - Product categories with tax inheritance
2. **Subcategory** - Sub-categories under categories  
3. **Item** - Menu items with pricing & availability
4. **Booking** - Time slot bookings (for bookable items)
5. **Addon** - Optional/mandatory add-ons for items





## Core Business Logic

- **Tax Inheritance & SSOT:**
  - The `is_tax_inherit` flag on items and subcategories lets the system decide whether to use the item's own tax or inherit from its parent (subcategory or category). If the item's tax is null and `is_tax_inherit` is true, the code recursively checks up the hierarchy for a tax value. This enforces a "Single Source of Truth" (SSOT) for tax rates and supports normalization, so tax changes at the parent level automatically apply to all children.

- **Pricing Engine (JSONB & Types):**
  - The pricing engine loads the `pricing_config` as a JSONB object, allowing flexible and future-proof pricing logic. For type 'A' (STATIC), only `base_price` is required. For other types (TIERED, DISCOUNTED, DYNAMIC), the config structure adapts to the pricing logic needed, as defined in the code. This approach enables easy insertion and validation of complex pricing rules per item.

- **Double Booking Prevention:**
  1. Every bookable item has `avl_time` and `avl_days` fields to define available slots.
  2. When a booking is requested, the system checks if the requested time matches the item's available time and day.
  3. I am currently book though out the slot but If a certain time slot is booked and confirmed, that slot is subtracted from the item's `avl_time`, so the remaining availability is always accurate and up-to-date (thought for partial booking)

## API Features & Examples

### 1. Advanced Search & Filtering

All list endpoints support powerful filtering, sorting, and pagination:

```bash
# Get items with filtering and sorting
GET /items?q=burger&minPrice=100&maxPrice=500&taxApplicable=true&sortBy=price&sortDir=asc&page=1&limit=20

# Response includes pagination metadata
{
  "page": 1,
  "limit": 20,
  "total": 47,
  "items": [
    {
      "id": "item_uuid",
      "name": "Margherita Pizza",
      "base_price": "300.00",
      "pricing_type": "STATIC",
      "tax_percentage": "5.00",
      "is_active": true,
      "is_bookable": false,
      "created_at": "2026-01-19T10:30:00+05:30"
    }
  ]
}
```

**Supported Query Parameters:**
- `q` - Text search (item name)
- `minPrice`, `maxPrice` - Price range filter
- `taxApplicable` - Filter by tax applicability (true/false)
- `activeOnly` - Show only active items (default: true)
- `sortBy` - Sort by `name`, `price`, or `createdAt`
- `sortDir` - `asc` or `desc`
- `page`, `limit` - Pagination

### 2. Item Management Examples

**Create Item with Pricing:**

```bash
POST /items
{
  "name": "Espresso",
  "description": "Single shot espresso",
  "categoryId": "cat_123",
  "subcategoryId": "subcat_456",
  "base_price": "120.00",
  "pricing_type": "STATIC",
  "pricing_config": { "base_price": 120 },
  "tax_applicable": true,
  "tax_percentage": "5.00",
  "is_tax_inherit": false
}
```

**Create Bookable Item with Availability:**

```bash
POST /items
{
  "name": "Venue Booking - 2 Hours",
  "categoryId": "cat_venue",
  "base_price": "5000.00",
  "pricing_type": "TIERED",
  "pricing_config": {
    "tiers": [
      { "upto": 2, "price": 5000 },
      { "upto": 4, "price": 9000 }
    ]
  },
  "is_bookable": true,
  "avl_days": "Monday,Tuesday,Wednesday,Thursday,Friday",
  "avl_time": "480"
}
```

### 3. Booking Examples

**Create Booking:**

```bash
POST /bookings
{
  "itemId": "item_venue_123",
  "user_name": "John Doe",
  "user_email": "john@example.com",
  "booking_date": "2026-02-15",
  "booking_start_time": "10:00",
  "booking_duration": "120",
  "status": "confirmed"
}

Response:
{
  "id": "booking_uuid",
  "itemId": "item_venue_123",
  "user_email": "john@example.com",
  "booking_date": "2026-02-15",
  "booking_start_time": "10:00",
  "booking_duration": "120",
  "status": "confirmed",
  "created_at": "2026-01-19T10:30:00+05:30"
}
```

### 4. Tax Inheritance

Tax automatically cascades from parent categories:

```bash
# Category with 18% tax
POST /categories
{
  "name": "Beverages",
  "tax_percentage": "18.00",
  "is_active": true
}

# Item in that category inherits tax if is_tax_inherit=true
POST /items
{
  "name": "Coffee",
  "categoryId": "cat_beverages",
  "base_price": "100.00",
  "pricing_type": "STATIC",
  "tax_applicable": true,
  "is_tax_inherit": true,
  "tax_percentage": null  # Will use parent's %
}
```

---

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16 (via Docker)

### Setup

1. **Clone & Install Dependencies**
   ```bash
   git clone <repository-url>
   cd menu_backend_guestara
   npm install
   cp .env.example .env
   # Edit .env with your database credentials
   ```

2. **Start PostgreSQL Container**
   ```bash
   npm run db:up
   # Wait for healthy status (check logs with: npm run db:logs)
   ```

3. **Initialize Database Schema**
   ```bash
   # Run migrations
   npm run prisma:migrate

   # Generate Prisma client
   npm run prisma:generate

   # (Optional) Seed sample data for testing
   npm run prisma:seed
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

   - API: http://localhost:3000
   - API Docs: http://localhost:3000/docs

## Development Workflow

### Making Schema Changes

When you modify `prisma/schema.prisma`:

```bash
# 1. Create and apply migration
npm run prisma:migrate

# 2. Regenerate Prisma client
npm run prisma:generate

# 3. Dev server restarts automatically
npm run dev
```

### Inspecting Database

```bash
# Open Prisma Studio (visual database tool)
npm run prisma:studio
# Opens at http://localhost:5555 with all your tables and data
```

### Database Commands

```bash
# View PostgreSQL logs
npm run db:logs

# Stop database container
npm run db:down

# Full reset (deletes all data)
npm run db:down
npm run db:up
npm run prisma:migrate
```

## NPM Scripts

```json
{
  "dev": "ts-node-dev --respawn --transpile-only app.ts",
  "build": "tsc -p .",
  "start": "node dist/app.js",
  "db:up": "docker-compose up -d",
  "db:down": "docker-compose down",
  "db:logs": "docker-compose logs -f db",
  "prisma:studio": "prisma studio --config ./prisma/prisma.config.ts",
  "prisma:migrate": "prisma migrate dev --name init_schema --config ./prisma/prisma.config.ts",
  "prisma:generate": "prisma generate --config ./prisma/prisma.config.ts",
  "prisma:status": "prisma migrate status --config ./prisma/prisma.config.ts",
  "prisma:seed": "ts-node prisma/seed.ts"
}
```

## Testing API

### Health Check
```bash
curl http://localhost:3000/health
```

### View API Documentation
```
http://localhost:3000/docs
```

## Database Connection

**Local Development:**
```
DATABASE_URL=postgresql://admin:admin123@localhost:5433/guestara_backend
```

**Inside Docker:**
```
DATABASE_URL=postgresql://admin:admin123@db:5432/guestara_backend
```

Environment variables are loaded from `.env` file.


## Common Tasks

### Reset Database (Development Only)
```bash
npm run db:down
rm -rf prisma/migrations
npm run db:up
npm run prisma:migrate
```

### View Migration Status
```bash
npm run prisma:status
```

### Fix Prisma Client Issues
```bash
npm run prisma:generate
```

### Seed Sample Data
```bash
# Populate database with test data (categories, items, bookings, addons)
npm run prisma:seed
```

## Important Notes

- When adding items to **subcategory**, set `categoryId` to empty string: `"categoryId": ""`
- The `is_active` field uses a visibility helper function (granular control, no direct DB updates)
- "isAvailable" = item is available per pricing/availability rules (days, times, pricing constraints)

## Troubleshooting

### "Database connection failed"
```bash
# Check if PostgreSQL is running
npm run db:logs

# Verify .env DATABASE_URL matches
# Should be: postgresql://admin:admin123@localhost:5433/guestara_backend
```

### "Prisma client not found"
```bash
npm run prisma:generate
```

### "Migration conflicts"
```bash
npm run prisma:status
# If conflicts exist, reset in development:
npm run db:down
rm -rf prisma/migrations
npm run db:up
npm run prisma:migrate
```

## Production Deployment

### Build & Package
```bash
npm run build
```

### Docker Deployment
```bash
# Build container
docker build -t guestara-app .

# Run with environment
docker run -p 3000:3000 --env-file .env guestara-app
```

The `Dockerfile` uses Node.js 20-alpine with multi-stage build for minimal image size.


## Loom Video Walkthrough

[Watch the video walkthrough](https://www.loom.com/share/ae1f810116cc4a53b1e36d9a8bca8eb5)


## Data Modeling & Design Decisions

- **Decimal for Price & Tax:**
  - All monetary values (`price`, `tax_percentage`) are stored as `Decimal` for precision and to avoid floating-point errors in calculations.

- **Tax Inheritance Logic:**
  - The `is_tax_inherit` flag on items/subcategories allows tax to be inherited from the parent category or subcategory. If `is_tax_inherit` is true and the item's own tax is null, the system recursively checks the parent for tax, ensuring a "Single Source of Truth" (SSOT) and easy updates.

- **Enum Usage for Pricing Type:**
  - The `pricing_type` field is an enum, simplifying logic and validation for different pricing strategies (STATIC, TIERED, etc.) and ensuring only valid types are used.

- **Flexible Pricing Engine:**
  - The pricing engine uses a `pricing_config` field (JSONB) to store complex pricing rules. For example, static pricing (A) only needs `base_price`, while tiered or dynamic pricing types use structured JSON for tiers or time windows. This allows future extensibility without schema changes.

- **Double-Booking Prevention:**
  1. Every bookable item has `avl_time` and `avl_days` fields to define available slots.
  2. When a booking is requested, the system checks if the requested time matches the item's available time and day.
  3. Confirmed bookings subtract the booked time from the item's `avl_time`, so remaining availability is always accurate and up-to-date in terms of partial booking. Full booked slot is not showing on availiblity and hence double booking prevented

- **PostgreSQL vs NoSQL Tradeoff:**
  - PostgreSQL was chosen for its "ACID by design." compliance, strong data consistency, and support for complex relationships. The use of JSONB fields provides NoSQL-like flexibility for pricing configs, while still benefiting from relational integrity and transactional guarantees.

- **Item Table Design:**
  - The `item` table contains many attributes to support a wide range of features (pricing, availability, tax, add-ons, booking linkage). While this could be normalized further, the current design balances extensibility and query simplicity for this project. Add-ons are managed in a separate table, and bookings are linked directly to items for clarity.

---

## Written Reflections

### 1. Why did you choose your database?

I chose PostgreSQL because it offers the best of both worlds: strict ACID compliance for data consistency (critical for financial transactions) and JSONB support for flexibility. This allowed me to store structured relationship data (Categories/Items) alongside dynamic, unstructured configuration data (like the Pricing Engine rules) without needing a separate NoSQL database.

### 2. Three things you learned while building this

- **Schema-First Design:** I learned that investing time in defining correct data types early (e.g., using Decimal for money instead of Float) prevents painful "hard migrations" later on.

- **Scalable Architecture:** I gained a deeper understanding of structuring a backend repository (Service-Controller pattern) to maintain code quality as the project grows.

- **TypeScript Ecosystem:** Coming from a Python background, I learned to leverage TypeScript's static typing to catch errors at compile-time, which significantly improved developer experience and code reliability.

### 3. The hardest technical or design challenge you faced

Implementing the Hierarchical Inheritance Model for taxes and pricing. Deciding between a "write-time snapshot" versus a "read-time lookup" (Null Fallback pattern) required significant research. I ultimately had to trade off between database read performance and data normalization to ensure that updates to a Category correctly cascaded down to Items without causing data drift.

### 4. What you would improve or refactor if you had more time

I partially implemented the Bulk Operation APIs to improve the administrator experience. For example, a single endpoint to apply a "Summer Collection" discount rule across an entire subcategory. Additionally, I would add Observability and Instrumentation middleware to track API usage patterns, allowing the business to generate KPIs based on user requests.

---





## Additional Resources

- **[Swagger/OpenAPI Docs](http://localhost:3000/docs)** - Interactive API documentation (auto-generated from Zod schemas)
- **[Prisma Studio](http://localhost:5555)** - Visual database manager
- **[API Features Documentation](./API_FEATURES.md)** - Detailed filtering, pagination, and search capabilities
- **Database Port:** localhost:5433 (PostgreSQL)

