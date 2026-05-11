import express from 'express';
import multer from 'multer';
import { analyzeUrl, analyzeBulk } from '../controllers/AnalysisController.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/analyze', analyzeUrl);
router.post('/analyze-bulk', upload.single('file'), analyzeBulk);

export default router;
