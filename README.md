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

tax in items comes from thier category (or subcategory) and use of COALESCE function of sql used to maintain then database view instead of duplicating data



### Features
1. auto tax inheritece
2. soft delete and availablity check through the actual value present in the coloumn
3. type-safe development and validation layer
4. clear file structure of this repo






### Notes & Tradeoffs






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


