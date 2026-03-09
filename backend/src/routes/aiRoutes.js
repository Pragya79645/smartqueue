const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

/**
 * AI Routes
 * These endpoints act as a proxy to the Python AI Engine
 * and return enhanced JSON responses to the frontend
 */

// GET /api/ai/health - Check AI Engine health status
router.get('/health', aiController.checkAiHealth);

// GET /api/ai/analyze - Get comprehensive AI analysis (prediction + current state)
router.get('/analyze', aiController.getAiAnalysis);

// POST /api/ai/detection - Process queue detection data
router.post('/detection', aiController.processDetection);

// POST /api/ai/predict-enhanced - Get enhanced prediction with rush analysis
router.post('/predict-enhanced', aiController.getEnhancedPrediction);

// POST /api/ai/process-frame - Process video frame for real-time detection
router.post('/process-frame', aiController.processFrame);

module.exports = router;
