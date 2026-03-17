const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');

// GET /staff - Get all staff (with optional filters)
router.get('/', staffController.getAllStaff);

// GET /staff/available/count - Get count of available staff
router.get('/available/count', staffController.getAvailableCount);

// GET /staff/allocation-state - Get current allocation state grouped by counter
router.get('/allocation-state', staffController.getAllocationState);

// POST /staff/apply-allocation - Apply allocation map and persist in staff state
router.post('/apply-allocation', staffController.applyAllocationState);

// GET /staff/:id - Get single staff member
router.get('/:id', staffController.getStaffById);

// POST /staff - Create new staff member
router.post('/', staffController.createStaff);

// PUT /staff/:id - Update staff member (full update)
router.put('/:id', staffController.updateStaff);

// PATCH /staff/:id/availability - Update staff availability
router.patch('/:id/availability', staffController.updateAvailability);

// PATCH /staff/:id/skills - Update staff skills
router.patch('/:id/skills', staffController.updateSkills);

// PATCH /staff/:id/assign - Assign staff to counter
router.patch('/:id/assign', staffController.assignCounter);

// DELETE /staff/:id - Delete staff member
router.delete('/:id', staffController.deleteStaff);

module.exports = router;
