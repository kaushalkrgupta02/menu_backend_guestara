import { Router } from 'express';
import { createItem, listItems, getItem, getItemPrice, patchItem, filterItems, getItemsByParent, bulkUpdatePriceConfig } from '../controllers/itemController';
import { createBooking, getAvailableSlots } from '../controllers/bookingController';
import { createAddon, listAddons } from '../controllers/addonController';

const router = Router();

router.post('/', createItem);
router.get('/by-parent', getItemsByParent);
router.get('/filter', filterItems);
router.patch('/bulk/price-config', bulkUpdatePriceConfig);
router.get('/', listItems);
router.get('/:id', getItem);
router.patch('/:id', patchItem);
router.get('/:id/price', getItemPrice);
router.post('/:id/bookings', createBooking);
router.get('/:id/available-slots', getAvailableSlots);
router.post('/:id/addons', createAddon);
router.get('/:id/addons', listAddons);
router.delete('/:id', async (req, res) => {
  // Soft delete
  const pool = (await import('../config/db_conn')).default;
  await pool.query(`UPDATE "Item" SET is_active=false WHERE id=$1`, [req.params.id]);
  res.json({ success: true });
});

export default router;