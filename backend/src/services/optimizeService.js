const axios = require('axios');
const logger = require('../utils/logger');

// Python AI Engine endpoint (will be Phase 3)
const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8001';

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

    // Transform data to Flask API format
    const flaskPayload = transformToFlaskFormat(queueData, staffData, constraints);

    // Call Python AI service
    const response = await axios.post(`${PYTHON_API_URL}/optimize`, flaskPayload, {
      timeout: 10000 // 10 seconds
    });

    logger.info('Optimization completed successfully');
    
    // Transform Flask response back to backend format
    return transformFlaskResponse(response.data);

  } catch (error) {
    const transientCodes = new Set(['ECONNREFUSED', 'ECONNRESET', 'ECONNABORTED', 'ETIMEDOUT']);
    if (transientCodes.has(error.code)) {
      logger.warn(`Python AI service unavailable on ${PYTHON_API_URL} (${error.code}). Using mock optimization.`);
      // Return mock optimization result for development
      return mockOptimization(data);
    }
    
    if (error.response) {
      logger.error('Optimization service error:', {
        status: error.response.status,
        data: error.response.data,
        message: error.message
      });
    } else {
      logger.error('Optimization service error:', error.message);
    }
    throw error;
  }
};

/**
 * Transform backend data format to Flask API expected format
 */
function transformToFlaskFormat(queueData, staffData, constraints = {}) {
  try {
    // Validate inputs
    if (!Array.isArray(queueData) || queueData.length === 0) {
      throw new Error('Queue data must be a non-empty array');
    }
    if (!Array.isArray(staffData) || staffData.length === 0) {
      throw new Error('Staff data must be a non-empty array');
    }

    // Build current queue load by counter type
    const current_queue_load = {};
    const predicted_queue_load = {};
    const counters = [];

    queueData.forEach((queue, index) => {
      if (!queue.counterId) {
        throw new Error(`Queue record ${index} missing counterId`);
      }
      // Map counter type from skills or use generic naming
      const counterType = mapCounterType(queue.counterId);
      
      current_queue_load[counterType] = queue.queueSize || 0;
      predicted_queue_load[counterType] = queue.predictedSize || queue.queueSize || 0;
      
      counters.push({
        id: index + 1,
        counter_type: counterType,
        max_capacity: constraints.maxCapacityPerCounter || 2,
        priority: queue.status === 'critical' ? 1 : 2
      });
    });

    // Transform staff data
    const staff = staffData.map((s, index) => {
      if (!s.name) {
        throw new Error(`Staff record ${index} missing name`);
      }
      // Calculate available time slots (8 hour shift = 8 slots)
      const available_slots = calculateAvailableSlots(s.shiftStart, s.shiftEnd);
      
      if (available_slots.length === 0) {
        throw new Error(`Staff ${s.name} has invalid shift times: ${s.shiftStart} - ${s.shiftEnd}`);
      }
      
      // Map skill level based on performance score
      const skill_level = s.performanceScore >= 90 ? 'advanced' : 
                          s.performanceScore >= 70 ? 'intermediate' : 'basic';
      
      // Calculate hourly rate based on skill level and performance
      const hourly_rate = calculateHourlyRate(skill_level, s.performanceScore);

      return {
        id: index + 1,
        name: s.name,
        skill_level: skill_level,
        skills: s.skills || ['general'],
        available_slots: available_slots,
        max_hours: available_slots.length,
        hourly_rate: hourly_rate
      };
    });

    // Generate time slots (8 hours = 8 slots)
    const time_slots = Array.from({ length: 8 }, (_, i) => i);

    return {
      current_queue_load,
      predicted_queue_load,
      staff,
      counters,
      time_slots,
      budget: constraints.budget || 5000.0
    };
  } catch (error) {
    logger.error(`Error transforming data to Flask format: ${error.message}`);
    throw error;
  }
}

/**
 * Map counter ID to counter type
 */
function mapCounterType(counterId) {
  const typeMap = {
    1: 'general',
    2: 'loan',
    3: 'account',
    4: 'cashier',
    5: 'inquiry',
    6: 'premium'
  };
  return typeMap[counterId] || `counter_${counterId}`;
}

/**
 * Calculate available time slots based on shift times
 */
function calculateAvailableSlots(shiftStart, shiftEnd) {
  try {
    // Default: 9 AM to 5 PM (8 hours)
    let start = 9;
    let end = 17;
    
    if (shiftStart && typeof shiftStart === 'string') {
      const startMatch = shiftStart.match(/(\d+):/);
      start = startMatch ? parseInt(startMatch[1]) : 9;
    }
    
    if (shiftEnd && typeof shiftEnd === 'string') {
      const endMatch = shiftEnd.match(/(\d+):/);
      end = endMatch ? parseInt(endMatch[1]) : 17;
    }
    
    // Validate times are reasonable
    if (start < 0 || start > 23 || end < 0 || end > 23) {
      logger.warn(`Invalid shift times: ${shiftStart} - ${shiftEnd}, using defaults`);
      start = 9;
      end = 17;
    }
    
    // Ensure end > start
    if (end <= start) {
      end = start + 8; // Default to 8 hour shift
    }
    
    const hours = end - start;
    
    // Return array of slot indices [0, 1, 2, ..., hours-1]
    return Array.from({ length: hours }, (_, i) => i);
  } catch (error) {
    logger.warn(`Error parsing shift times: ${error.message}, using defaults`);
    return Array.from({ length: 8 }, (_, i) => i);
  }
}

/**
 * Calculate hourly rate based on skill level and performance
 */
function calculateHourlyRate(skill_level, performanceScore) {
  const baseRates = {
    basic: 15.0,
    intermediate: 20.0,
    advanced: 25.0
  };
  
  const baseRate = baseRates[skill_level] || 15.0;
  // Add bonus based on performance (up to 20% more)
  const performanceBonus = (performanceScore / 100) * (baseRate * 0.2);
  
  return parseFloat((baseRate + performanceBonus).toFixed(2));
}

/**
 * Transform Flask response to backend format
 */
function transformFlaskResponse(flaskResponse) {
  // If infeasible or no staff recommended
  if (flaskResponse.status === 'infeasible' || !flaskResponse.recommended_staff) {
    return {
      success: false,
      allocations: [],
      totalScore: 0,
      status: flaskResponse.status || 'infeasible',
      message: 'No feasible allocation found',
      predictedQueue: flaskResponse.predicted_queue || 0,
      totalCost: flaskResponse.total_cost || 0,
      timestamp: new Date().toISOString()
    };
  }

  // Transform recommended_staff to backend allocations format
  const assignmentTimestamp = new Date().toISOString();

  const allocations = flaskResponse.recommended_staff.map(rec => ({
    staffId: rec.staff_id,
    staffName: rec.staff_name,
    counterId: rec.counter,
    counterType: rec.counter_type,
    startTime: rec.start_time,
    endTime: rec.end_time,
    lastMovedAt: rec.last_moved_at || assignmentTimestamp,
    priority: 1,
    reason: `Optimized allocation for ${rec.counter_type}`
  }));

  return {
    success: true,
    allocations,
    totalScore: allocations.length * 100,
    totalCost: flaskResponse.total_cost || 0,
    predictedQueue: flaskResponse.predicted_queue || 0,
    status: flaskResponse.status || 'optimal',
    algorithm: 'or-tools-optimization',
    timestamp: new Date().toISOString()
  };
}

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
