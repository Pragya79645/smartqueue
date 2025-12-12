const Allocation = require('../models/Allocation');
const QueueRecord = require('../models/QueueRecord');
const Staff = require('../models/Staff');
const optimizeService = require('../services/optimizeService');
const logger = require('../utils/logger');

// POST /allocate/now - Get optimized allocation recommendation
exports.allocateNow = async (req, res) => {
  try {
    // Get current queue data
    const queueData = await QueueRecord.aggregate([
      {
        $sort: { timestamp: -1 }
      },
      {
        $group: {
          _id: '$counterId',
          latestData: { $first: '$$ROOT' }
        }
      },
      {
        $replaceRoot: { newRoot: '$latestData' }
      }
    ]);

    if (queueData.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No queue data available'
      });
    }

    // Get available staff
    const staffData = await Staff.find({
      availability: { $in: ['available', 'busy'] }
    });

    if (staffData.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No staff available'
      });
    }

    // Get optimization from AI engine
    const optimization = await optimizeService.getOptimizedAllocation({
      queueData: queueData.map(q => ({
        counterId: q.counterId,
        queueSize: q.queueSize,
        predictedSize: q.predictedSize,
        status: q.status
      })),
      staffData: staffData.map(s => ({
        staffId: s.staffId,
        name: s.name,
        skills: s.skills,
        availability: s.availability,
        currentCounter: s.currentCounter,
        performanceScore: s.performanceScore
      })),
      constraints: req.body.constraints || {}
    });

    // Save allocation to database
    const allocation = new Allocation({
      allocations: optimization.allocations,
      totalScore: optimization.totalScore,
      predictedLoad: {
        totalLoad: queueData.reduce((sum, q) => sum + q.queueSize, 0),
        algorithm: optimization.algorithm || 'OR-Tools'
      },
      status: 'pending'
    });

    await allocation.save();

    logger.info(`New allocation created: ${allocation._id}`);

    res.status(201).json({
      success: true,
      data: allocation,
      optimization: optimization,
      message: 'Allocation recommendation generated'
    });

  } catch (error) {
    logger.error('Error in allocation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate allocation'
    });
  }
};

// GET /allocate/recommendation - Get latest allocation recommendation
exports.getRecommendation = async (req, res) => {
  try {
    const { status = 'pending' } = req.query;

    const allocation = await Allocation.findOne({ status })
      .sort({ timestamp: -1 });

    if (!allocation) {
      return res.status(404).json({
        success: false,
        error: 'No allocation found'
      });
    }

    res.json({
      success: true,
      data: allocation
    });
  } catch (error) {
    logger.error('Error fetching recommendation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recommendation'
    });
  }
};

// POST /allocate/:id/apply - Apply allocation (assign staff to counters)
exports.applyAllocation = async (req, res) => {
  try {
    const allocation = await Allocation.findById(req.params.id);

    if (!allocation) {
      return res.status(404).json({
        success: false,
        error: 'Allocation not found'
      });
    }

    if (allocation.status === 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Allocation already applied'
      });
    }

    // Apply each allocation
    const results = [];
    for (const alloc of allocation.allocations) {
      const staff = await Staff.findOneAndUpdate(
        { staffId: alloc.staffId },
        {
          currentCounter: alloc.counterId,
          availability: 'busy'
        },
        { new: true }
      );

      if (staff) {
        results.push({
          staffId: alloc.staffId,
          counterId: alloc.counterId,
          success: true
        });
      } else {
        results.push({
          staffId: alloc.staffId,
          counterId: alloc.counterId,
          success: false,
          error: 'Staff not found'
        });
      }
    }

    // Update allocation status
    allocation.status = 'active';
    allocation.appliedBy = req.body.appliedBy || 'system';
    await allocation.save();

    logger.info(`Allocation applied: ${allocation._id}`);

    res.json({
      success: true,
      data: allocation,
      results,
      message: 'Allocation applied successfully'
    });

  } catch (error) {
    logger.error('Error applying allocation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to apply allocation'
    });
  }
};

// GET /allocate/history - Get allocation history
exports.getAllocationHistory = async (req, res) => {
  try {
    const { limit = 20, status } = req.query;
    
    let query = {};
    if (status) query.status = status;

    const history = await Allocation.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      count: history.length,
      data: history
    });
  } catch (error) {
    logger.error('Error fetching allocation history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch allocation history'
    });
  }
};

// GET /allocate/stats - Get allocation statistics
exports.getAllocationStats = async (req, res) => {
  try {
    const totalAllocations = await Allocation.countDocuments();
    const activeAllocations = await Allocation.countDocuments({ status: 'active' });
    const pendingAllocations = await Allocation.countDocuments({ status: 'pending' });

    // Get staff distribution
    const staffDistribution = await Staff.aggregate([
      {
        $group: {
          _id: '$availability',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        totalAllocations,
        activeAllocations,
        pendingAllocations,
        staffDistribution
      }
    });
  } catch (error) {
    logger.error('Error fetching allocation stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch allocation stats'
    });
  }
};

// GET /allocate/requirement - Calculate staff requirement
exports.getStaffRequirement = async (req, res) => {
  try {
    // Get current queue data
    const queueData = await QueueRecord.aggregate([
      {
        $sort: { timestamp: -1 }
      },
      {
        $group: {
          _id: '$counterId',
          latestData: { $first: '$$ROOT' }
        }
      },
      {
        $replaceRoot: { newRoot: '$latestData' }
      }
    ]);

    if (queueData.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No queue data available'
      });
    }

    const requirement = optimizeService.calculateStaffRequirement(queueData);

    const availableStaff = await Staff.countDocuments({ availability: 'available' });
    const busyStaff = await Staff.countDocuments({ availability: 'busy' });

    res.json({
      success: true,
      data: {
        ...requirement,
        currentAvailable: availableStaff,
        currentBusy: busyStaff,
        needsMoreStaff: requirement.requiredStaff > (availableStaff + busyStaff)
      }
    });
  } catch (error) {
    logger.error('Error calculating requirement:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate staff requirement'
    });
  }
};
