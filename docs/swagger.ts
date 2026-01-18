const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Guestara Menu & Service Management API',
    version: '1.0.0',
    description: 'API for managing categories, subcategories, items, pricing, availability, and add-ons.',
  },
  servers: [{ url: 'http://localhost:3000' }],
  tags: [
    { name: 'Health', description: 'Health check' },
    { name: 'Categories', description: 'Manage categories' },
    { name: 'Subcategories', description: 'Manage subcategories' },
    { name: 'Items', description: 'Manage items and pricing' },
    { name: 'Bookings', description: 'Manage bookings and availability' },
    { name: 'Addons', description: 'Manage item add-ons' },
    { name: 'Bulk', description: 'Bulk operations' }
  ],

  components: {
    parameters: {
      page: { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
      limit: { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
      sortBy: { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['name', 'price', 'createdAt'] } },
      sortDir: { name: 'sortDir', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
      q: { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Partial text search on item name' },
      minPrice: { name: 'minPrice', in: 'query', schema: { type: 'number' } },
      maxPrice: { name: 'maxPrice', in: 'query', schema: { type: 'number' } },
      categoryId: { name: 'categoryId', in: 'query', schema: { type: 'string' } },
      activeOnly: { name: 'activeOnly', in: 'query', schema: { type: 'boolean', default: true } },
      taxApplicable: { name: 'taxApplicable', in: 'query', schema: { type: 'boolean' } },
      currentTime: { name: 'currentTime', in: 'query', schema: { type: 'string', format: 'date-time' }, description: 'Optional ISO date-time override for DYNAMIC pricing and TIERED bookable items. For bookable TIERED items, calculates usage hours from booking start to this time.' }
    },
    schemas: {
      Category: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          image: { type: 'string', nullable: true },
          description: { type: 'string', nullable: true },
          tax_applicable: { type: 'boolean' },
          tax_percentage: { type: 'number', format: 'decimal', description: 'Decimal with up to 2 decimal places' },
          is_active: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      CategoryCreate: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          image: { type: 'string', nullable: true },
          description: { type: 'string', nullable: true },
          tax_applicable: { type: 'boolean' },
          tax_percentage: { type: 'number', format: 'decimal', description: 'Decimal with up to 2 decimal places' },
          is_active: { type: 'boolean' }
        },
        required: ['name']
      },
      CategoryUpdate: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          image: { type: 'string', nullable: true },
          description: { type: 'string', nullable: true },
          tax_applicable: { type: 'boolean' },
          tax_percentage: { type: 'number', format: 'decimal', description: 'Decimal with up to 2 decimal places' },
          is_active: { type: 'boolean' }
        }
      },
      Subcategory: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          categoryId: { type: 'string' },
          name: { type: 'string' },
          image: { type: 'string', nullable: true },
          description: { type: 'string', nullable: true },
          is_active: { type: 'boolean' },
          tax_applicable: { type: 'boolean', nullable: true },
          tax_percentage: { type: 'number', format: 'decimal', description: 'Decimal with up to 2 decimal places', nullable: true },
          is_tax_inherit: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      SubcategoryCreate: {
        type: 'object',
        properties: {
          categoryId: { type: 'string' },
          name: { type: 'string' },
          image: { type: 'string', nullable: true },
          description: { type: 'string', nullable: true },
          tax_applicable: { type: 'boolean', nullable: true },
          tax_percentage: { type: 'number', format: 'decimal', description: 'Decimal with up to 2 decimal places', nullable: true },
          is_tax_inherit: { type: 'boolean', nullable: true },
          is_active: { type: 'boolean', nullable: true }
        },
        required: ['categoryId', 'name']
      },
      SubcategoryUpdate: {
        type: 'object',
        properties: {
          categoryId: { type: 'string' },
          name: { type: 'string' },
          image: { type: 'string', nullable: true },
          description: { type: 'string', nullable: true },
          tax_applicable: { type: 'boolean', nullable: true },
          tax_percentage: { type: 'number', format: 'decimal', description: 'Decimal with up to 2 decimal places', nullable: true },
          is_tax_inherit: { type: 'boolean', nullable: true },
          is_active: { type: 'boolean', nullable: true }
        }
      },

      Item: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          image: { type: 'string', nullable: true },
          is_active: { type: 'boolean' },
          categoryId: { type: 'string', nullable: true },
          subcategoryId: { type: 'string', nullable: true },
          // Added relationship objects to match your examples
          category: { $ref: '#/components/schemas/Category', nullable: true },
          subcategory: { $ref: '#/components/schemas/Subcategory', nullable: true },
          base_price: { type: 'number', nullable: true },
          type_of_pricing: { type: 'string', nullable: true },  
          price_config: { type: 'object', nullable: true, description: 'Optional: pricing configuration. See examples in components/examples.' },
          tax_applicable: { type: 'boolean', nullable: true },
          tax_percentage: { type: 'number', format: 'decimal', description: 'Decimal with up to 2 decimal places', nullable: true },
          is_tax_inherit: { type: 'boolean' },
          avl_days: { type: 'array', items: { type: 'string' } },
          avl_times: { 
            type: 'array', 
            items: { type: 'object', properties: { start: { type: 'string' }, end: { type: 'string' } } }, 
            nullable: true 
          },
          is_bookable: { type: 'boolean', description: 'Whether this item can be booked (e.g., yoga class, meeting room)' },
          resolvedPrice: { $ref: '#/components/schemas/ItemPriceResponse', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      ItemCreate: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          image: { type: 'string', nullable: true },
          categoryId: { type: 'string', nullable: true },
          subcategoryId: { type: 'string', nullable: true },
          base_price: { type: 'number', nullable: true },
          type_of_pricing: { type: 'string', nullable: true },
          price_config: { type: 'object', nullable: true, description: 'Pricing configuration object. See examples. Note: if type_of_pricing is "E" (DYNAMIC), you must provide non-empty avl_times and windows must intersect avl_times.' },
          tax_applicable: { type: 'boolean', nullable: true },
          tax_percentage: { type: 'number', format: 'decimal', description: 'Decimal with up to 2 decimal places', nullable: true },
          is_tax_inherit: { type: 'boolean', nullable: true },
          avl_days: { type: 'array', items: { type: 'string' } },
          avl_times: { 
            type: 'array', 
            items: { type: 'object', properties: { start: { type: 'string' }, end: { type: 'string' } } }, 
            nullable: true 
          },
          is_bookable: { type: 'boolean', nullable: true, description: 'Whether this item can be booked' },
          is_active: { type: 'boolean', nullable: true }
        },
        required: ['name']
      },
      ItemUpdate: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          image: { type: 'string', nullable: true },
          categoryId: { type: 'string', nullable: true },
          subcategoryId: { type: 'string', nullable: true },
          base_price: { type: 'number', nullable: true },
          type_of_pricing: { type: 'string', nullable: true },
          price_config: { type: 'object', nullable: true, description: 'Pricing configuration object. See examples. Note: if type_of_pricing is "E" (DYNAMIC), you must provide non-empty avl_times and windows must intersect avl_times.' },
          tax_applicable: { type: 'boolean', nullable: true },
          tax_percentage: { type: 'number', format: 'decimal', description: 'Decimal with up to 2 decimal places', nullable: true },
          is_tax_inherit: { type: 'boolean', nullable: true },
          avl_days: { type: 'array', items: { type: 'string' } },
          avl_times: { 
            type: 'array', 
            items: { type: 'object', properties: { start: { type: 'string' }, end: { type: 'string' } } }, 
            nullable: true 
          },
          is_bookable: { type: 'boolean', nullable: true, description: 'Whether this item can be booked' },
          is_active: { type: 'boolean', nullable: true }
        }
      },
      ItemPriceResponse: {
        type: 'object',
        properties: {
          appliedPricingRule: { type: 'object', description: 'Applied pricing details. Structure varies by pricing type (e.g., { type: "TIERED", applied: { upto: 5, price: 100 } })' },
          basePrice: { type: 'number' },
          discount: { type: 'number' },
          taxPercentage: { type: 'number' },
          taxAmount: { type: 'number' },
          grandTotal: { type: 'number' },
          isAvailable: { type: 'boolean' },
          is_active: { type: 'boolean' },
          note: { type: 'string', nullable: true }
        }
      },
      BookingCreate: {
        type: 'object',
        properties: {
          startTime: { type: 'string', format: 'date-time', description: 'ISO 8601 datetime (e.g., 2026-01-16T09:00:00.000Z)' },
          endTime: { type: 'string', format: 'date-time', description: 'ISO 8601 datetime (e.g., 2026-01-16T10:00:00.000Z)' }
        },
        required: ['startTime', 'endTime']
      },
      Booking: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          itemId: { type: 'string' },
          start_time: { type: 'string', format: 'date-time' },
          end_time: { type: 'string', format: 'date-time' },
          status: { type: 'string', enum: ['confirmed', 'cancelled', 'completed'] },
          item: { type: 'object', description: 'Item details' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      AvailableSlot: {
        type: 'object',
        properties: {
          startTime: { type: 'string', description: 'Time in HH:MM format (e.g., 09:00)' },
          endTime: { type: 'string', description: 'Time in HH:MM format (e.g., 10:00)' },
          available: { type: 'boolean', description: 'Whether this slot is available for booking' }
        }
      },
      AvailableSlotsResponse: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Requested date (YYYY-MM-DD)' },
          dayOfWeek: { type: 'string', description: 'Day of week (mon, tue, etc.)' },
          itemId: { type: 'string' },
          itemName: { type: 'string' },
          slots: { type: 'array', items: { $ref: '#/components/schemas/AvailableSlot' } }
        }
      },
      AddonCreate: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Addon name' },
          price: { type: 'number', description: 'Addon price' },
          isMandatory: { type: 'boolean', description: 'Whether this addon is mandatory', default: false },
          isActive: { type: 'boolean', description: 'Whether this addon is active', default: true }
        },
        required: ['name', 'price']
      },
      Addon: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          itemId: { type: 'string' },
          name: { type: 'string' },
          price: { type: 'number' },
          is_mandatory: { type: 'boolean' },
          is_active: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      AddonsListResponse: {
        type: 'object',
        properties: {
          itemId: { type: 'string' },
          itemName: { type: 'string' },
          total: { type: 'integer' },
          addons: { type: 'array', items: { $ref: '#/components/schemas/Addon' } }
        }
      },
      Error: { type: 'object', properties: { error: { type: 'string' } } }
    },
    examples: {
      Coffee: {
        summary: 'Coffee example (uses base_price)',
        value: {
          name: 'Coffee',
          base_price: 200,
          avl_days: null,
          avl_times: null
        }
      },
      BreakfastCombo: {
        summary: 'Breakfast Combo example (uses base_price)',
        value: {
          name: 'Breakfast Combo',
          base_price: 199,
          avl_days: null,
          avl_times: null
        }
      },
      PriceConfigStatic: {
        summary: 'Price config example - STATIC (amount ignored in favor of base_price)',
        value: { type: 'STATIC', config: { amount: 200 } }
      },
      PriceConfigTiered: {
        summary: 'Price config example - TIERED',
        value: { type: 'TIERED', config: { tiers: [{ upto: 1, price: 300 }, { upto: 2, price: 500 }] } }
      },
      PriceConfigDiscounted: {
        summary: 'Price config example - DISCOUNTED (provide only val & is_perc). Note: item must have a non-zero base_price when using DISCOUNTED pricing',
        value: { type: 'DISCOUNTED', config: { val: 10, is_perc: true } }
      },
      PriceConfigDynamic: {
        summary: 'Price config example - DYNAMIC',
        value: { type: 'DYNAMIC', config: { windows: [{ start: '08:00', end: '11:00', price: 199 }] } }
      },
      CategoryExample: {
        summary: 'Category response example',
        value: {
          id: 'cat_abc123',
          name: 'Beverages',
          image: 'https://example.com/bev.png',
          description: 'Hot and cold drinks',
          tax_applicable: true,
          tax_percentage: 5,
          is_active: true,
          createdAt: '2026-01-17T11:14:36Z',
          updatedAt: '2026-01-17T11:14:36Z'
        }
      }
    }
  },

  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health',
        description: 'Simple health check',
        responses: { '200': { description: 'OK' } }
      }
    },

    '/categories': {
      post: {
        tags: ['Categories'],
        summary: 'Create',
        description: 'Create a category. Optional fields may be omitted.',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CategoryCreate' } } } },
        responses: { '201': { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Category' } } } } }
      },
      get: {
        tags: ['Categories'],
        summary: 'List',
        description: 'List categories',
        parameters: [{ $ref: '#/components/parameters/page' }, { $ref: '#/components/parameters/limit' }, { $ref: '#/components/parameters/sortBy' }, { $ref: '#/components/parameters/sortDir' }, { $ref: '#/components/parameters/activeOnly' }],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: { 
                  type: 'object', 
                  properties: { 
                    page: { type: 'integer' }, 
                    limit: { type: 'integer' }, 
                    total: { type: 'integer' }, 
                    items: { type: 'array', items: { $ref: '#/components/schemas/Category' } } 
                  } 
                }
              }
            }
          }
        }
      }
    },

    '/categories/{id}': {
      get: {
        tags: ['Categories'],
        summary: 'Get',
        description: 'Get category with subcategories and items',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: { 
                  allOf: [
                    { $ref: '#/components/schemas/Category' },
                    { 
                      type: 'object', 
                      properties: { 
                        subcategories: { type: 'array', items: { $ref: '#/components/schemas/Subcategory' } }, 
                        items: { type: 'array', items: { $ref: '#/components/schemas/Item' } } 
                      } 
                    }
                  ]
                }
              }
            }
          },
          '404': { description: 'Not found' }
        }
      },
      patch: {
        tags: ['Categories'],
        summary: 'Update',
        description: 'Update category. Request payload should contain only fields to update.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CategoryUpdate' } } } },
        responses: { '200': { description: 'Updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Category' } } } } }
      },

    },

    '/subcategories': {
      post: {
        tags: ['Subcategories'],
        summary: 'Create',
        description: 'Create a subcategory. Optional fields may be omitted.',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SubcategoryCreate' } } } },
        responses: { '201': { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Subcategory' } } } } }
      },
      get: {
        tags: ['Subcategories'],
        summary: 'List',
        description: 'List subcategories',
        parameters: [{ $ref: '#/components/parameters/page' }, { $ref: '#/components/parameters/limit' }, { $ref: '#/components/parameters/categoryId' }],
        responses: { '200': { description: 'OK' } }
      }
    },

    '/subcategories/{id}': {
      get: {
        summary: 'Get a subcategory with items',
        tags: ['Subcategories'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/Subcategory' } } } }, '404': { description: 'Not found' } }
      },
      patch: {
        summary: 'Update',
        description: 'Update a subcategory. Request payload should contain only fields to update.',
        tags: ['Subcategories'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SubcategoryUpdate' } } } },
        responses: { '200': { description: 'Updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Subcategory' } } } } }
      },

    },

    '/items': {
      post: {
        tags: ['Items'],
        summary: 'Create',
        description: 'Create an item. Optional fields may be omitted.',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ItemCreate' } } } },
        responses: { '201': { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Item' } } } } }
      },
      get: {
        summary: 'List items',
        tags: ['Items'],
        parameters: [{ $ref: '#/components/parameters/page' }, { $ref: '#/components/parameters/limit' }, { $ref: '#/components/parameters/q' }, { $ref: '#/components/parameters/minPrice' }, { $ref: '#/components/parameters/maxPrice' }],
        responses: { '200': { description: 'OK' } }
      }
    },

    '/items/filter': {
      get: {
        tags: ['Items'],
        summary: 'Filter items by parent active flags',
        parameters: [
          { name: 'categoryActive', in: 'query', schema: { type: 'boolean' }, description: 'Filter items whose parent category is active (true) or inactive (false)' },
          { name: 'subcategoryActive', in: 'query', schema: { type: 'boolean' }, description: 'Filter items whose parent subcategory is active (true) or inactive (false)' },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' }
        ],
        responses: { '200': { description: 'OK' } }
      }
    },

    '/items/by-parent': {
      get: {
        tags: ['Items'],
        summary: 'Get items for a specific parent (category or subcategory) and optionally filter by parent is_active',
        parameters: [
          { name: 'categoryId', in: 'query', schema: { type: 'string' }, description: 'Provide category id to list items under this category (exclusive with subcategoryId)' },
          { name: 'subcategoryId', in: 'query', schema: { type: 'string' }, description: 'Provide subcategory id to list items under this subcategory (exclusive with categoryId)' },
          { name: 'is_active', in: 'query', schema: { type: 'boolean' }, description: 'Optional: filter by parent is_active (true|false)' },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' }
        ],
        responses: { '200': { description: 'OK' } }
      }
    },

    '/items/bulk/price-config': {
      patch: {
        tags: ['Bulk','Items'],
        summary: 'Bulk update price_config',
        description: 'Update price_config for multiple items under a parent',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  categoryId: { type: 'string' },
                  subcategoryId: { type: 'string' },
                  types: { type: 'array', items: { type: 'string', enum: ['A','B','C','D','E'] } },
                  configs: { type: 'object', description: 'Map of type key -> price_config payload' }
                },
                required: ['types','configs']
              },
              example: {
                categoryId: 'cat_abc123',
                types: ['B','D'],
                configs: {
                  'B': { tiers: [{ upto: 1, price: 300 }, { upto: null, price: 200 }] },
                  'D': { val: 10, is_perc: true }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, results: { type: 'array', items: { type: 'object' } } } } } } },
          '400': { description: 'Invalid request', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } }
        }
      }
    },

    '/items/{id}': {
      patch: {
        tags: ['Items'],
        summary: 'Update',
        description: 'Update an item. Request payload should contain only fields to update.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ItemUpdate' } } } },
        responses: { '200': { description: 'Updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Item' } } } } }
      }
    },



    '/items/{id}/price': {
      get: {
        tags: ['Items'],
        summary: 'Resolve item price',
        description: 'Calculate price for an item. For bookable TIERED items, automatically calculates usage hours from booking start to current time.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }, 
          { $ref: '#/components/parameters/currentTime' }
        ],
        responses: {
          '200': { description: 'Price resolved', content: { 'application/json': { schema: { $ref: '#/components/schemas/ItemPriceResponse' } } } },
          '404': { description: 'Not found' }
        }
      }
    },

    '/items/{id}/bookings': {
      post: {
        tags: ['Bookings'],
        summary: 'Create booking',
        description: 'Book a time slot for an item. Prevents double booking and validates availability.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Item ID' }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/BookingCreate' },
              example: {
                startTime: '2026-01-16T09:00:00.000Z',
                endTime: '2026-01-16T10:00:00.000Z'
              }
            }
          }
        },
        responses: {
          '201': { description: 'Booking created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Booking' } } } },
          '400': { description: 'Invalid request or item not bookable' },
          '404': { description: 'Item not found' },
          '409': { description: 'Time slot already booked (conflict)' }
        }
      }
    },

    '/items/{id}/available-slots': {
      get: {
        tags: ['Bookings'],
        summary: 'Get available slots',
        description: 'Get available time slots for an item on a specific date',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Item ID' },
          { name: 'date', in: 'query', required: true, schema: { type: 'string', format: 'date' }, description: 'Date in YYYY-MM-DD format (e.g., 2026-01-16)' }
        ],
        responses: {
          '200': { description: 'Available slots returned', content: { 'application/json': { schema: { $ref: '#/components/schemas/AvailableSlotsResponse' } } } },
          '400': { description: 'Invalid request or item not bookable' },
          '404': { description: 'Item not found' }
        }
      }
    },

    '/items/{id}/addons': {
      post: {
        tags: ['Addons'],
        summary: 'Create addon',
        description: 'Create a new addon for an item. Addons can be optional or mandatory and affect final price.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Item ID' }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AddonCreate' },
              example: {
                name: 'Tomato Ketchup',
                price: 1.5,
                isMandatory: false,
                isActive: true
              }
            }
          }
        },
        responses: {
          '201': { description: 'Addon created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Addon' } } } },
          '400': { description: 'Invalid request' },
          '404': { description: 'Item not found' }
        }
      },
      get: {
        tags: ['Addons'],
        summary: 'List addons',
        description: 'Get all addons for an item',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Item ID' },
          { name: 'activeOnly', in: 'query', schema: { type: 'boolean', default: true }, description: 'Filter active addons only' }
        ],
        responses: {
          '200': { description: 'Addons list returned', content: { 'application/json': { schema: { $ref: '#/components/schemas/AddonsListResponse' } } } },
          '404': { description: 'Item not found' }
        }
      }
    }
  }
};

export default swaggerDocument;