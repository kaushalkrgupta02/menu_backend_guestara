const swaggerDocument = {
  openapi: '3.0.0',
  info: { title: 'Guestara Menu & Service Management API', 
            version: '1.0.0', 
            description: 'API for managing categories, subcategories, items, pricing, availability, bookings, and add-ons.' 
        },
  servers: [{ url: 'http://localhost:3000' }],

  paths: {
    '/health': {
        get: {
            summary: 'Health Check',
            responses: {
                '200': {
                    description: 'OK'
                }
            }
        }
    }
  }
};

export default swaggerDocument;