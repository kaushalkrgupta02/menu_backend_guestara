# Guestara – NodeJs Assignment

##  Menu & Services Management Backend



### Project Structure
./routes/: Defines the API endpoints.

./controllers/: Handles HTTP requests, parses data, and returns status codes.

./services/: The business logic like tax inheritance and pricing.

./config/: Centralized configuration for the db client and environment variables.

./models.ts: Source of TypeScript interfaces and shared types



### Database Schema Discussion
Postgres SQL choosen due to almost fix struture and service related to menu & billing inventory that needs data integrity and storage of JSONB data mimics the nosql feature.

key tables:
1. categories
2. subcategories
3. items
4. bookings
5. Addon


>1. The Chain: Item → Subcategory → Category.
>2. Inheriting: If is_tax_inherit is true, tax fields are stored as null to ensure the "Single Source of Truth" comes from the parent.
>3. Overriding: Providing a manual tax rate at the item level "shadows" the parent’s value.

The core philosophy is database Normalization. By clearing the fields (setting them to null), you are ensuring that the "truth" about the tax rate only exists in one place (the Category). Updating 1 parent and "nullifying" 100 children is much faster and less likely to lock your database than recalculating and writing new values to 100 children.

### Features
1. auto tax inheritece
2. soft delete and availablity check through the actual value present in the coloumn
3. type-safe development and validation layer
4. clear file structure of this repo

## Docker Setup

### Prerequisites
- Docker and Docker Compose installed
- `.env` file configured (copy from `.env.example`)

### Quick Start with Docker

1. **Clone and setup environment:**
   ```bash
   git clone <repository-url>
   cd menu_backend_guestara
   cp .env.example .env
   # Edit .env with your database credentials
   ```

2. **Start the complete stack:**
   ```bash
   npm run docker:up
   ```

3. **Run database migrations:**
   ```bash
   docker-compose exec app npx prisma migrate dev --name init
   ```

4. **Generate Prisma client:**
   ```bash
   docker-compose exec app npx prisma generate
   ```

### Docker Commands

```bash
# Build and start services
npm run docker:build && npm run docker:up

# View logs
npm run docker:logs

# Restart app
npm run docker:restart

# Stop services
npm run docker:down

# Clean up (removes containers and volumes)
docker-compose down -v
```

### Services

- **Database (PostgreSQL 16)**: `http://localhost:5433`
- **API Server**: `http://localhost:3000`
- **API Documentation**: `http://localhost:3000/docs`

### Development vs Production

- **Development**: Use `npm run dev` for hot-reload
- **Production**: Use Docker for containerized deployment

### Development with Hot-Reload

For development with source code mounting and hot-reload:

```bash
# Start with development override (mounts source code)
docker-compose -f docker-compose.yml -f docker-compose.override.yml up

# Or use the convenience script (if added to package.json)
npm run docker:dev
```

This mounts your source code into the container and uses `npm run dev` for hot-reload during development.






### Notes & Tradeoffs
while adding Items to any subcategory
please make "categoryId": "string" ---> "categoryId": ""

I have added the helper fuction for is_active status of an item (not performing the core db opertion for updating the is_active value). Granual Control and JOIN operation only.


in Items isAvaiable means “Is the item available according to pricing/availability rules (e.g., avl_days, avl_times, dynamic pricing constraints)?”




### Steps to run locally

1. Clone & Dependencies
    1. git clone <url>
    2. go to folder menu_backend_guestara
    3. npm install 

2. Up the docker service for database (install docker first)
    1. $ docker-compose up -d

3. make .env file and copy .env_example to it

4. Prisma migration
    1. npx prisma migrate dev --name init
    2. npx prisma generate

5. start server using npm run dev




-- to check the schema goto prima studio run 
 npx prisma studio --config ./prisma/prisma.config.ts
-- to do migration
 npx prisma migrate dev --name init_schema --config ./prisma/prisma.config.ts