import { Router } from 'express';
import { createCategory, listCategories, getCategory, patchCategory, deactivateCategory } from '../controllers/categoryController';

const router = Router();

router.post('/', createCategory);
router.get('/', listCategories);
router.get('/:id', getCategory);
router.patch('/:id', patchCategory);
router.delete('/:id', deactivateCategory);

export default router;