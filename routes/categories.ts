import { Router } from 'express';
import { createCategory, listCategories, getCategory, patchCategory } from '../controllers/categoryController';

const router = Router();

router.post('/', createCategory);
router.get('/', listCategories);
router.get('/:id', getCategory);
router.patch('/:id', patchCategory);

export default router;