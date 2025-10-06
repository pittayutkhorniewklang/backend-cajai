import { Router } from 'express';
import { getCategories, getProductsByCategory } from '../controllers/categories.js';

const router = Router();

router.get('/', getCategories);
router.get('/:code/products', getProductsByCategory);

export default router;
