# Guestara – Menu & Services Management Backend

A Node.js/Express backend for managing restaurant menus, services, pricing, bookings, and add-ons with PostgreSQL.

## Project Structure

```
├── config/
│   ├── db_conn.ts          # Database connection pool
│   └── prisma_client.ts    # Prisma client singleton
├── controllers/            # HTTP request handlers
│   ├── itemController.ts      # Item CRUD & pricing
│   ├── bookingController.ts   # Booking management
│   ├── addonController.ts     # Add-ons management
│   ├── categoryController.ts  # Categories
│   └── subcategoryController.ts
├── services/               # Business logic
│   ├── price_engine.ts     # Pricing calculation engine
│   └── price_config.ts     # Pricing config validation
├── routes/                 # API route definitions
├── utils/                  # Helper utilities
├── prisma/
│   ├── schema.prisma       # Database schema (enums, models)
│   └── prisma.config.ts    # Prisma config
├── docs/
│   └── swagger.ts          # OpenAPI/Swagger documentation
└── app.ts                  # Express app entry point
```

## Database Schema

### Key Tables

1. **Category** - Product categories with tax inheritance
2. **Subcategory** - Sub-categories under categories  
3. **Item** - Menu items with pricing & availability
4. **Booking** - Time slot bookings (for bookable items)
5. **Addon** - Optional/mandatory add-ons for items

### Tax Inheritance Chain

```
Category (tax_percentage = 18%)
  ↓
Subcategory (inherits if is_tax_inherit=true)
  ↓
Item (inherits if is_tax_inherit=true)
```

If `is_tax_inherit=false`, the item has its own tax rate instead of inheriting.

### Pricing System

**Pricing Types (PricingKey enum):**
- **A** - STATIC: Fixed base price
- **B** - TIERED: Price varies by quantity tiers
- **C** - COMPLIMENTARY: Free item
- **D** - DISCOUNTED: Base price with discount applied
- **E** - DYNAMIC: Time-based pricing windows

### Booking Status

**BookingStatus enum:**
- **confirmed** - Booking is confirmed
- **cancelled** - Booking was cancelled
- **completed** - Booking completed

## API Features

1. **Items Management** - Full CRUD with pricing & availability
2. **Pricing Engine** - Multi-strategy pricing (static, tiered, dynamic, etc.)
3. **Bookings** - Time slot booking with double-booking prevention
4. **Add-ons** - Optional/mandatory add-ons for items
5. **Tax Inheritance** - Automatic tax calculation with inheritance
6. **Availability** - Item availability based on days, time windows

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
# Opens at http://localhost:5555
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
  "prisma:generate": "prisma generate"
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

## Key Architecture Decisions

1. **Tax Inheritance** - Single source of truth: taxes defined at parent level, inherited by children
2. **Pricing Strategy** - Multiple pricing types via `PricingKey` enum with dedicated engines
3. **Soft Delete** - Items marked `is_active=false` instead of hard deletion
4. **Availability Checks** - Items checked against `avl_days`, `avl_times` for availability
5. **Booking Prevention** - Double-booking prevented via unique constraint + conflict detection

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
npx prisma migrate status --config ./prisma/prisma.config.ts
```

### Fix Prisma Client Issues
```bash
npm run prisma:generate
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
npx prisma migrate status --config ./prisma/prisma.config.ts
# If conflicts exist, reset in development:
npm run db:down
rm -rf prisma/migrations
npm run db:up
npm run prisma:migrate
```

## Production Deployment

1. Build the application:
   ```bash
   npm run build
   ```

2. Use Docker for containerized deployment:
   ```bash
   docker build -t guestara-app .
   docker run -p 3000:3000 --env-file .env guestara-app
   ```

## Additional Resources

- [Swagger/OpenAPI Docs](http://localhost:3000/docs) - Interactive API documentation
- [Prisma Studio](http://localhost:5555) - Visual database manager
- [PostgreSQL Connection Info](http://localhost:5433) - Database port

## License

Proprietary - Guestara
