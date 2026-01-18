const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Guestara Menu & Service Management API',
    version: '1.0.0',
    description: 'API for managing categories, subcategories, items, pricing, availability, and add-ons.',
  },
  servers: [{ url: 'http://localhost:3000' }],

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
      usageHours: { name: 'usageHours', in: 'query', schema: { type: 'number' }, description: 'Used by TIERED pricing to select correct tier' },
      currentTime: { name: 'currentTime', in: 'query', schema: { type: 'string', format: 'date-time' }, description: 'Optional ISO date-time override for DYNAMIC pricing (e.g., 2026-01-18T09:30:00Z). Use timezone-aware strings to specify offsets.' }
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
          is_active: { type: 'boolean', nullable: true }
        }
      },
      ItemPriceResponse: {
        type: 'object',
        properties: {
          appliedPricingRule: { type: 'object', description: 'Applied pricing details. Structure varies by pricing type (e.g., { type: "TIERED", applied: { upto: 5, price: 100 } })' },
          basePrice: { type: 'number' },
          type_of_pricing: { type: 'string' },
          discount: { type: 'number' },
          taxPercentage: { type: 'number' },
          taxAmount: { type: 'number' },
          grandTotal: { type: 'number' },
          isAvailable: { type: 'boolean' },
          is_active: { type: 'boolean' },
          note: { type: 'string', nullable: true }
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
        summary: 'Health Check',
        responses: { '200': { description: 'OK' } }
      }
    },

    '/categories': {
      post: {
        summary: 'Create a category',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CategoryCreate' } } } },
        responses: { '201': { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Category' } } } } }
      },
      get: {
        summary: 'List categories',
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
        summary: 'Get category with subcategories & items',
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
        summary: 'Patch a category ',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CategoryUpdate' } } } },
        responses: { '200': { description: 'Updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Category' } } } } }
      },

    },

    '/subcategories': {
      post: {
        summary: 'Create a subcategory',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SubcategoryCreate' } } } },
        responses: { '201': { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Subcategory' } } } } }
      },
      get: {
        summary: 'List subcategories',
        parameters: [{ $ref: '#/components/parameters/page' }, { $ref: '#/components/parameters/limit' }, { $ref: '#/components/parameters/categoryId' }],
        responses: { '200': { description: 'OK' } }
      }
    },

    '/subcategories/{id}': {
      get: {
        summary: 'Get a subcategory with items',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/Subcategory' } } } }, '404': { description: 'Not found' } }
      },
      patch: {
        summary: 'Patch a subcategory',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SubcategoryUpdate' } } } },
        responses: { '200': { description: 'Updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Subcategory' } } } } }
      },

    },

    '/items': {
      post: {
        summary: 'Create an item',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ItemCreate' } } } },
        responses: { '201': { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Item' } } } } }
      },
      get: {
        summary: 'List items',
        parameters: [{ $ref: '#/components/parameters/page' }, { $ref: '#/components/parameters/limit' }, { $ref: '#/components/parameters/q' }, { $ref: '#/components/parameters/minPrice' }, { $ref: '#/components/parameters/maxPrice' }],
        responses: { '200': { description: 'OK' } }
      }
    },

    '/items/filter': {
      get: {
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
        summary: 'Bulk update price_config for items under a category or subcategory by types',
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
        summary: 'Patch an item',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ItemUpdate' } } } },
        responses: { '200': { description: 'Updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Item' } } } } }
      }
    },



    '/items/{id}/price': {
      get: {
        summary: 'Resolve item price',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }, 
          { $ref: '#/components/parameters/usageHours' }, 
          { $ref: '#/components/parameters/currentTime' }
        ],
        responses: {
          '200': { description: 'Price resolved', content: { 'application/json': { schema: { $ref: '#/components/schemas/ItemPriceResponse' } } } },
          '404': { description: 'Not found' }
        }
      }
    }
  }
};

export default swaggerDocument;