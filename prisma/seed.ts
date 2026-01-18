import { getPrisma } from '../config/prisma_client';

const prisma = getPrisma();

async function main() {
  console.log('Starting database seeding...');

  // Clear existing data (optional - comment out if you want to keep data)

  // CREATE CATEGORIES
  const pizzaCategory = await prisma.category.create({
    data: {
      name: 'Pizza',
      description: 'Delicious Italian pizzas',
      tax_applicable: true,
      tax_percentage: 18,
      is_active: true,
    },
  });

  const beveragesCategory = await prisma.category.create({
    data: {
      name: 'Beverages',
      description: 'Refreshing drinks',
      tax_applicable: true,
      tax_percentage: 5,
      is_active: true,
    },
  });

  const servicesCategory = await prisma.category.create({
    data: {
      name: 'Services',
      description: 'Bookable services',
      tax_applicable: true,
      tax_percentage: 18,
      is_active: true,
    },
  });

  console.log('Categories created');

  // CREATE SUBCATEGORIES
  const vegetarianSub = await prisma.subcategory.create({
    data: {
      categoryId: pizzaCategory.id,
      name: 'Vegetarian Pizzas',
      description: 'Fresh veggie pizzas',
      is_active: true,
      is_tax_inherit: true,
    },
  });

  const nonVegSub = await prisma.subcategory.create({
    data: {
      categoryId: pizzaCategory.id,
      name: 'Non-Vegetarian Pizzas',
      description: 'Meat lover pizzas',
      is_active: true,
      is_tax_inherit: true,
    },
  });

  console.log('Subcategories created');



  // CREATE ITEMS

  const margheritaPizza = await prisma.item.create({
    data: {
      name: 'Margherita Pizza',
      description: 'Classic cheese pizza with tomato and basil',
      base_price: 300,
      type_of_pricing: 'A', // STATIC
      is_tax_inherit: true,
      is_active: true,
      is_bookable: false,
      subcategoryId: vegetarianSub.id,
      avl_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      avl_times: [
        { start: '11:00', end: '23:00' },
      ],
    },
  });

  const burgerItem = await prisma.item.create({
    data: {
      name: 'Burger Combo',
      description: 'Delicious burger with fries',
      base_price: 250,
      type_of_pricing: 'B', // TIERED
      price_config: {
        type: 'TIERED',
        config: {
          tiers: [
            { upto: 5, price: 250 },
            { upto: 10, price: 240 },
            { upto: null, price: 220 }, // null means unbounded
          ],
        },
      },
      is_tax_inherit: true,
      is_active: true,
      is_bookable: false,
      categoryId: beveragesCategory.id,
      avl_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      avl_times: [
        { start: '12:00', end: '22:00' },
      ],
    },
  });

  const discountedDeal = await prisma.item.create({
    data: {
      name: 'Happy Hour Deal',
      description: '30% off on selected items',
      base_price: 500,
      type_of_pricing: 'D', // DISCOUNTED
      price_config: {
        type: 'DISCOUNTED',
        config: {
          base: 500,
          val: 30, // 30% discount
          is_perc: true,
        },
      },
      is_tax_inherit: true,
      is_active: true,
      is_bookable: false,
      categoryId: beveragesCategory.id,
      avl_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      avl_times: [
        { start: '17:00', end: '20:00' },
      ],
    },
  });

  const freeWater = await prisma.item.create({
    data: {
      name: 'Complimentary Water',
      description: 'Free water glass',
      type_of_pricing: 'C', // COMPLIMENTARY
      is_tax_inherit: true,
      is_active: true,
      is_bookable: false,
      categoryId: beveragesCategory.id,
      avl_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    },
  });

  const coffeeItem = await prisma.item.create({
    data: {
      name: 'Coffee',
      description: 'Hot & Cold Coffee',
      type_of_pricing: 'E', // DYNAMIC
      price_config: {
        type: 'DYNAMIC',
        config: {
          windows: [
            { start: '06:00', end: '10:00', price: 150 }, // Morning rush
            { start: '10:00', end: '17:00', price: 120 }, // Regular hours
            { start: '17:00', end: '23:00', price: 100 }, // Evening discount
          ],
        },
      },
      is_tax_inherit: true,
      is_active: true,
      is_bookable: false,
      categoryId: beveragesCategory.id,
      avl_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    },
  });

  // BOOKABLE ITEM (Yoga Class)
  const yogaClass = await prisma.item.create({
    data: {
      name: 'Yoga Class',
      description: '1-hour yoga session',
      base_price: 500,
      type_of_pricing: 'A', // STATIC
      is_tax_inherit: true,
      is_active: true,
      is_bookable: true,
      categoryId: servicesCategory.id,
      avl_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      avl_times: [
        { start: '06:00', end: '08:00' },
        { start: '18:00', end: '19:30' },
      ],
    },
  });

  console.log('Items created');

  // CREATE BOOKINGS
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  tomorrow.setHours(6, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrow.getTime() + 60 * 60 * 1000);

  const booking1 = await prisma.booking.create({
    data: {
      itemId: yogaClass.id,
      start_time: tomorrow,
      end_time: tomorrowEnd,
      status: 'confirmed',
    },
  });

  const booking2 = await prisma.booking.create({
    data: {
      itemId: yogaClass.id,
      start_time: new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000),
      end_time: new Date(tomorrow.getTime() + 25 * 60 * 60 * 1000),
      status: 'confirmed',
    },
  });

  console.log('Bookings created');

  // CREATE ADD-ONS
  const extraCheeseAddon = await prisma.addon.create({
    data: {
      itemId: margheritaPizza.id,
      name: 'Extra Cheese',
      price: 50,
      is_mandatory: false,
      is_active: true,
    },
  });

  const baconAddon = await prisma.addon.create({
    data: {
      itemId: burgerItem.id,
      name: 'Bacon',
      price: 75,
      is_mandatory: false,
      is_active: true,
    },
  });

  const dressingAddon = await prisma.addon.create({
    data: {
      itemId: burgerItem.id,
      name: 'Special Sauce',
      price: 25,
      is_mandatory: true, // Mandatory add-on
      is_active: true,
    },
  });

  const matAddon = await prisma.addon.create({
    data: {
      itemId: yogaClass.id,
      name: 'Yoga Mat Rental',
      price: 100,
      is_mandatory: false,
      is_active: true,
    },
  });

  console.log('Add-ons created');
  console.log('Database seeding completed successfully!');
  console.log('Sample data created:');
  console.log('   - 3 Categories');
  console.log('   - 2 Subcategories');
  console.log('   - 6 Items (with different pricing types)');
  console.log('   - 2 Bookings');
  console.log('   - 4 Add-ons');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
