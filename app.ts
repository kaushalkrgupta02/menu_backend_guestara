import 'dotenv/config';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import swaggerDocument from './docs/swagger';
import { verifyConnection } from './config/db_conn';

const app = express();
app.use(express.json());

// Routes
import categoriesRouter from './routes/categories';
import subcategoriesRouter from './routes/subcategories';
import itemsRouter from './routes/items';

app.use('/categories', categoriesRouter);
app.use('/subcategories', subcategoriesRouter);
app.use('/items', itemsRouter);

// Swagger 
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

export default app;

if (require.main === module) {
  const port = process.env.PORT ?? 3000;
  app.listen(port, async () => {
    console.log(`Server running on port ${port}`);
    try {
      await verifyConnection();
    } catch (err) {
      console.error('Database connection failed on startup:', (err as Error).message);
      console.error('Server is running but database is not connected. Check your DATABASE_URL and database container.');
    }
  });
}
