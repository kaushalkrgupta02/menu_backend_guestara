import { Router } from 'express';
import { createItem, listItems, getItem, getItemPrice } from '../controllers/itemController';

const router = Router();

router.post('/', createItem);
router.get('/', listItems);
router.get('/:id', getItem);
router.get('/:id/price', getItemPrice);
router.delete('/:id', async (req, res) => {
  // Soft delete
  const pool = (await import('../config/db_conn')).default;
  await pool.query(`UPDATE "Item" SET is_active=false WHERE id=$1`, [req.params.id]);
  res.json({ success: true });
});

export default router;