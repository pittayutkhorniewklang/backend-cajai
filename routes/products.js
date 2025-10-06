import { Router } from 'express';
import { getProducts, createProduct, purchaseProduct } from '../controllers/products.js';

const router = Router();

router.get('/', getProducts);
router.post('/', createProduct);
router.post('/:code/purchase', purchaseProduct);

export default router;
