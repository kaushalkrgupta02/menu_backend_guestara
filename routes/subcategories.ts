import { Router } from 'express';
import { createSubcategory, listSubcategories, getSubcategory, deactivateSubcategory } from '../controllers/subcategoryController';

const router = Router();

router.post('/', createSubcategory);
router.get('/', listSubcategories);
router.get('/:id', getSubcategory);
router.delete('/:id', deactivateSubcategory);

export default router;