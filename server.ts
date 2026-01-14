import express from 'express';
import 'dotenv/config';
import swaggerUi from 'swagger-ui-express';
import { verifyConnection } from './config/get_db';

const app = express();
app.use(express.json());

const swaggerDocument = {
  openapi: '3.0.0',
  info: { title: 'Guestara Menu & Service Management Backend API', version: '1.0.0' },
  paths: {
      '/health': {
      get: {
        summary: 'DB health',
        responses: {
          '200': { description: 'db OK' },
          '500': { description: 'db Error' }
        }
      }
    }
  }
};

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get('/health', async (req, res) => {
  try {
    await verifyConnection();
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    console.error('Health check failed:', (err as Error).message);
    res.status(500).json({ status: 'error', database: 'disconnected', message: (err as Error).message });
  }
});

const port = process.env.PORT ?? 3000;

app.listen(port, async () => {
  console.log(`Server running on port ${port}`);
  try {
    await verifyConnection();
  } catch (err) {
    console.error('⚠ Database connection failed on startup:', (err as Error).message);
    console.error('Server is running but database is not connected. Check your DATABASE_URL and database container.');
  }
});

export default app;