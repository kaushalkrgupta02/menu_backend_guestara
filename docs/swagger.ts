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
      currentTime: { name: 'currentTime', in: 'query', schema: { type: 'string', format: 'date-time' }, description: 'Optional override time for DYNAMIC pricing' }
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
          tax_percentage: { type: 'integer' },
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
          tax_percentage: { type: 'integer' },
          is_active: { type: 'boolean' }
        },
        required: ['name']
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
          tax_percentage: { type: 'integer', nullable: true },
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
          tax_percentage: { type: 'integer', nullable: true },
          is_active: { type: 'boolean', nullable: true }
        },
        required: ['categoryId', 'name']
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
          tax_applicable: { type: 'boolean', nullable: true },
          tax_percentage: { type: 'integer', nullable: true },
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
          tax_applicable: { type: 'boolean', nullable: true },
          tax_percentage: { type: 'integer', nullable: true },
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
      ItemPriceResponse: {
        type: 'object',
        properties: {
          pricingType: { type: 'string' },
          basePrice: { type: 'number' },
          type_of_pricing: { type: 'string' },
          discount: { type: 'number' },
          taxPercentage: { type: 'number' },
          taxAmount: { type: 'number' },
          grandTotal: { type: 'number' },
          isAvailable: { type: 'boolean' },
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
      delete: {
        summary: 'Soft-delete category',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' } }
      }
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