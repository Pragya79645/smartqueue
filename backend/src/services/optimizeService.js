const axios = require('axios');
const logger = require('../utils/logger');

// Python AI Engine endpoint (will be Phase 3)
const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000';

/**
 * Call Python AI engine for staff optimization using OR-Tools
 * @param {Object} data - Optimization input data
 * @returns {Promise<Object>} Optimization result
 */
exports.getOptimizedAllocation = async (data) => {
  try {
    const { queueData, staffData, constraints } = data;

    // Validate input
    if (!queueData || !staffData) {
      throw new Error('Queue data and staff data are required');
    }

    // Call Python AI service
    const response = await axios.post(`${PYTHON_API_URL}/optimize`, {
      queues: queueData,
      staff: staffData,
      constraints: constraints || {}
    }, {
      timeout: 10000 // 10 seconds
    });

    logger.info('Optimization completed successfully');
    return response.data;

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      logger.error('Python AI service not available');
      // Return mock optimization result for development
      return mockOptimization(data);
    }
    
    logger.error('Optimization service error:', error.message);
    throw error;
  }
};

/**
 * Mock optimization for development/testing when Python service is unavailable
 */
function mockOptimization(data) {
  const { queueData, staffData } = data;
  
  // Simple greedy allocation algorithm as fallback
  const allocations = [];
  const availableStaff = staffData.filter(s => s.availability === 'available');
  
  // Sort queues by size (largest first)
  const sortedQueues = [...queueData].sort((a, b) => b.queueSize - a.queueSize);
  
  let staffIndex = 0;
  sortedQueues.forEach(queue => {
    if (queue.queueSize > 5 && staffIndex < availableStaff.length) {
      const staff = availableStaff[staffIndex];
      allocations.push({
        staffId: staff.staffId,
        staffName: staff.name,
        counterId: queue.counterId,
        priority: queue.queueSize > 10 ? 1 : 2,
        reason: `Queue size: ${queue.queueSize} (${queue.status})`
      });
      staffIndex++;
    }
  });

  return {
    success: true,
    allocations,
    totalScore: allocations.length * 100,
    algorithm: 'mock-greedy',
    timestamp: new Date().toISOString()
  };
}

/**
 * Calculate simple staff requirement based on queue load
 */
exports.calculateStaffRequirement = (queueData) => {
  const totalLoad = queueData.reduce((sum, q) => sum + q.queueSize, 0);
  const avgLoad = totalLoad / queueData.length;
  
  // Rule: 1 staff per 5 people in queue
  const requiredStaff = Math.ceil(totalLoad / 5);
  
  return {
    totalLoad,
    avgLoad: parseFloat(avgLoad.toFixed(2)),
    requiredStaff,
    criticalCounters: queueData.filter(q => q.status === 'critical').length,
    busyCounters: queueData.filter(q => q.status === 'busy').length
  };
};
