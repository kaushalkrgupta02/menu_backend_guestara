import { Router } from 'express';
import { createSubcategory, listSubcategories, getSubcategory, patchSubcategory } from '../controllers/subcategoryController';

const router = Router();

router.post('/', createSubcategory);
router.get('/', listSubcategories);
router.get('/:id', getSubcategory);
router.patch('/:id', patchSubcategory);

export default router;