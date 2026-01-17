import { Router } from 'express';
import { createSubcategory, listSubcategories, getSubcategory, deactivateSubcategory, patchSubcategory } from '../controllers/subcategoryController';

const router = Router();

router.post('/', createSubcategory);
router.get('/', listSubcategories);
router.get('/:id', getSubcategory);
router.patch('/:id', patchSubcategory);
router.delete('/:id', deactivateSubcategory);

export default router;