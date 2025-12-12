const Staff = require('../models/Staff');
const logger = require('../utils/logger');

// GET /staff - Get all staff
exports.getAllStaff = async (req, res) => {
  try {
    const { availability, skills } = req.query;
    
    let query = {};
    if (availability) query.availability = availability;
    if (skills) query.skills = { $in: skills.split(',') };

    const staff = await Staff.find(query).sort({ staffId: 1 });

    res.json({
      success: true,
      count: staff.length,
      data: staff
    });
  } catch (error) {
    logger.error('Error fetching staff:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch staff data'
    });
  }
};

// GET /staff/:id - Get single staff member
exports.getStaffById = async (req, res) => {
  try {
    const staff = await Staff.findOne({ staffId: req.params.id });

    if (!staff) {
      return res.status(404).json({
        success: false,
        error: 'Staff member not found'
      });
    }

    res.json({
      success: true,
      data: staff
    });
  } catch (error) {
    logger.error('Error fetching staff:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch staff data'
    });
  }
};

// POST /staff - Create new staff member
exports.createStaff = async (req, res) => {
  try {
    const { staffId, name, email, phone, skills, shiftStart, shiftEnd } = req.body;

    if (!staffId || !name || !email || !phone) {
      return res.status(400).json({
        success: false,
        error: 'staffId, name, email, and phone are required'
      });
    }

    // Check if staff already exists
    const existing = await Staff.findOne({ staffId });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Staff member with this ID already exists'
      });
    }

    const staff = new Staff({
      staffId,
      name,
      email,
      phone,
      skills: skills || ['general'],
      shiftStart: shiftStart || '09:00',
      shiftEnd: shiftEnd || '17:00',
      availability: 'available'
    });

    await staff.save();

    logger.info(`New staff created: ${staffId} - ${name}`);

    res.status(201).json({
      success: true,
      data: staff,
      message: 'Staff member created successfully'
    });
  } catch (error) {
    logger.error('Error creating staff:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create staff member'
    });
  }
};

// PUT /staff/:id - Update staff member
exports.updateStaff = async (req, res) => {
  try {
    const updates = req.body;
    
    // Prevent changing staffId
    delete updates.staffId;

    const staff = await Staff.findOneAndUpdate(
      { staffId: req.params.id },
      updates,
      { new: true, runValidators: true }
    );

    if (!staff) {
      return res.status(404).json({
        success: false,
        error: 'Staff member not found'
      });
    }

    logger.info(`Staff updated: ${req.params.id}`);

    res.json({
      success: true,
      data: staff,
      message: 'Staff member updated successfully'
    });
  } catch (error) {
    logger.error('Error updating staff:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update staff member'
    });
  }
};

// PATCH /staff/:id/availability - Update staff availability
exports.updateAvailability = async (req, res) => {
  try {
    const { availability } = req.body;

    if (!availability || !['available', 'busy', 'break', 'offline'].includes(availability)) {
      return res.status(400).json({
        success: false,
        error: 'Valid availability status is required'
      });
    }

    const staff = await Staff.findOneAndUpdate(
      { staffId: req.params.id },
      { availability },
      { new: true }
    );

    if (!staff) {
      return res.status(404).json({
        success: false,
        error: 'Staff member not found'
      });
    }

    logger.info(`Staff availability updated: ${req.params.id} -> ${availability}`);

    res.json({
      success: true,
      data: staff,
      message: 'Availability updated successfully'
    });
  } catch (error) {
    logger.error('Error updating availability:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update availability'
    });
  }
};

// PATCH /staff/:id/skills - Update staff skills
exports.updateSkills = async (req, res) => {
  try {
    const { skills } = req.body;

    if (!Array.isArray(skills) || skills.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Skills array is required'
      });
    }

    const staff = await Staff.findOneAndUpdate(
      { staffId: req.params.id },
      { skills },
      { new: true, runValidators: true }
    );

    if (!staff) {
      return res.status(404).json({
        success: false,
        error: 'Staff member not found'
      });
    }

    logger.info(`Staff skills updated: ${req.params.id}`);

    res.json({
      success: true,
      data: staff,
      message: 'Skills updated successfully'
    });
  } catch (error) {
    logger.error('Error updating skills:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update skills'
    });
  }
};

// PATCH /staff/:id/assign - Assign staff to counter
exports.assignCounter = async (req, res) => {
  try {
    const { counterId } = req.body;

    if (counterId === undefined) {
      return res.status(400).json({
        success: false,
        error: 'counterId is required'
      });
    }

    const staff = await Staff.findOneAndUpdate(
      { staffId: req.params.id },
      { 
        currentCounter: counterId,
        availability: counterId === null ? 'available' : 'busy'
      },
      { new: true }
    );

    if (!staff) {
      return res.status(404).json({
        success: false,
        error: 'Staff member not found'
      });
    }

    logger.info(`Staff assigned: ${req.params.id} -> Counter ${counterId}`);

    res.json({
      success: true,
      data: staff,
      message: `Staff ${counterId === null ? 'unassigned' : 'assigned to counter ' + counterId}`
    });
  } catch (error) {
    logger.error('Error assigning staff:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign staff'
    });
  }
};

// DELETE /staff/:id - Delete staff member
exports.deleteStaff = async (req, res) => {
  try {
    const staff = await Staff.findOneAndDelete({ staffId: req.params.id });

    if (!staff) {
      return res.status(404).json({
        success: false,
        error: 'Staff member not found'
      });
    }

    logger.info(`Staff deleted: ${req.params.id}`);

    res.json({
      success: true,
      message: 'Staff member deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting staff:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete staff member'
    });
  }
};

// GET /staff/available/count - Get count of available staff
exports.getAvailableCount = async (req, res) => {
  try {
    const count = await Staff.countDocuments({ availability: 'available' });

    res.json({
      success: true,
      availableStaff: count
    });
  } catch (error) {
    logger.error('Error counting available staff:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to count available staff'
    });
  }
};
