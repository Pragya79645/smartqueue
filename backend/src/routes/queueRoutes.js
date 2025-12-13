const express = require('express');
const router = express.Router();
const queueController = require('../controllers/queueController');

// GET /queue/live - Get current live queue data for all counters
router.get('/live', queueController.getLiveQueue);

// POST /queue/update - Update queue data for a single counter
router.post('/update', queueController.updateQueue);

// POST /queue/update/batch - Batch update for multiple counters
router.post('/update/batch', queueController.batchUpdateQueue);

// GET /queue/history - Get historical queue data
router.get('/history', queueController.getQueueHistory);

// GET /queue/stats - Get queue statistics
router.get('/stats', queueController.getQueueStats);

// GET /queue/predict - Get queue predictions
router.get('/predict', queueController.getPredictions);

// DELETE /queue/history - Clean old data
router.delete('/history', queueController.cleanOldData);

module.exports = router;
