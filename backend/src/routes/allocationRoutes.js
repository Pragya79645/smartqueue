const express = require('express');
const router = express.Router();
const allocationController = require('../controllers/allocationController');

// POST /allocate/now - Generate optimized allocation recommendation
router.post('/now', allocationController.allocateNow);

// GET /allocate/recommendation - Get latest allocation recommendation
router.get('/recommendation', allocationController.getRecommendation);

// POST /allocate/:id/apply - Apply allocation (assign staff)
router.post('/:id/apply', allocationController.applyAllocation);

// GET /allocate/history - Get allocation history
router.get('/history', allocationController.getAllocationHistory);

// GET /allocate/stats - Get allocation statistics
router.get('/stats', allocationController.getAllocationStats);

// GET /allocate/requirement - Calculate staff requirement
router.get('/requirement', allocationController.getStaffRequirement);

module.exports = router;
