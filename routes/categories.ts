import { Router } from 'express';
import { createCategory, listCategories, getCategory, deactivateCategory } from '../controllers/categoryController';

const router = Router();

router.post('/', createCategory);
router.get('/', listCategories);
router.get('/:id', getCategory);
router.delete('/:id', deactivateCategory);

export default router;