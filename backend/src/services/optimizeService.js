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
    return transformFlaskResponse(response.data, queueData);

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
        priority: derivePriorityFromQueue(queue)
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
 * Derive a human-practical priority from queue conditions.
 * Priority 1 = high, Priority 2 = normal.
 */
function derivePriorityFromQueue(queue = {}) {
  const status = String(queue.status || '').toLowerCase();
  const queueSize = Number(queue.queueSize || 0);
  const predictedSize = Number(queue.predictedSize || 0);

  if (status === 'critical' || status === 'busy') return 1;
  if (queueSize >= 6 || predictedSize >= 6) return 1;
  return 2;
}

/**
 * Transform Flask response to backend format
 */
function transformFlaskResponse(flaskResponse, queueData = []) {
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

  const normalizePriority = (value) => {
    if (value === 1 || value === '1' || value === 'high') return 1;
    if (value === 2 || value === '2' || value === 'normal') return 2;
    return 2;
  };

  const queueByCounterId = new Map();
  const queueByCounterType = new Map();
  queueData.forEach((queue) => {
    if (queue?.counterId !== undefined && queue?.counterId !== null) {
      queueByCounterId.set(String(queue.counterId), queue);
      queueByCounterType.set(mapCounterType(queue.counterId), queue);
    }
  });

  const resolveFallbackPriority = (rec) => {
    const byId = queueByCounterId.get(String(rec?.counter ?? ''));
    if (byId) return derivePriorityFromQueue(byId);

    const byType = queueByCounterType.get(String(rec?.counter_type || ''));
    if (byType) return derivePriorityFromQueue(byType);

    return 2;
  };

  const rawAllocations = flaskResponse.recommended_staff.map(rec => ({
    staffId: rec.staff_id,
    staffName: rec.staff_name,
    counterId: rec.counter,
    counterType: rec.counter_type,
    startTime: rec.start_time,
    endTime: rec.end_time,
    lastMovedAt: rec.last_moved_at || assignmentTimestamp,
    priority: rec.priority !== undefined && rec.priority !== null
      ? normalizePriority(rec.priority)
      : resolveFallbackPriority(rec),
    reason: `Optimized allocation for ${rec.counter_type}`
  }));

  const queueSizeByCounter = new Map();
  queueData.forEach((q) => {
    if (q?.counterId !== undefined && q?.counterId !== null) {
      queueSizeByCounter.set(String(q.counterId), Number(q.queueSize || 0));
    }
  });

  const requiredByCounter = new Map();
  queueSizeByCounter.forEach((queueSize, counterId) => {
    const needed = Math.ceil(Number(queueSize || 0) / 5);
    requiredByCounter.set(counterId, queueSize > 0 ? Math.max(1, needed) : 0);
  });

  // STRICT RULE: one staff member can appear only once in a recommendation cycle.
  const uniqueAllocations = dedupeAllocationsByStaff(rawAllocations, queueSizeByCounter);
  const balancedAllocations = rebalanceAllocationsToDemand(uniqueAllocations, requiredByCounter, queueSizeByCounter);
  const allocations = capAllocationsByRequiredStaff(balancedAllocations, requiredByCounter, queueSizeByCounter);

  if (uniqueAllocations.length !== rawAllocations.length) {
    logger.warn(`Removed ${rawAllocations.length - uniqueAllocations.length} duplicate staff assignments from optimization output`);
  }
  if (balancedAllocations.length !== uniqueAllocations.length) {
    logger.warn(`Rebalanced ${uniqueAllocations.length - balancedAllocations.length} assignments during demand alignment`);
  }
  if (allocations.length !== balancedAllocations.length) {
    logger.warn(`Trimmed ${balancedAllocations.length - allocations.length} excess staff assignments beyond required capacity`);
  }

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
 * Keep only one assignment per staff member.
 * Preference order:
 * 1) Higher priority (1 is highest)
 * 2) Higher queue size counter
 * 3) Earlier start time if available
 */
function dedupeAllocationsByStaff(allocations, queueSizeByCounter = new Map()) {
  const normalized = [...allocations].sort((a, b) => {
    const pA = Number(a.priority || 2);
    const pB = Number(b.priority || 2);
    if (pA !== pB) return pA - pB;

    const qA = queueSizeByCounter.get(String(a.counterId)) || 0;
    const qB = queueSizeByCounter.get(String(b.counterId)) || 0;
    if (qA !== qB) return qB - qA;

    const tA = new Date(a.startTime || 0).getTime();
    const tB = new Date(b.startTime || 0).getTime();
    return tA - tB;
  });

  const used = new Set();
  const unique = [];

  for (const item of normalized) {
    const sid = String(item.staffId || '').trim();
    if (!sid || used.has(sid)) {
      continue;
    }
    used.add(sid);
    unique.push(item);
  }

  return unique;
}

function capAllocationsByRequiredStaff(allocations, requiredByCounter = new Map(), queueSizeByCounter = new Map()) {
  const grouped = new Map();
  for (const item of allocations) {
    const counterId = String(item.counterId || '');
    if (!grouped.has(counterId)) {
      grouped.set(counterId, []);
    }
    grouped.get(counterId).push(item);
  }

  const trimmed = [];
  for (const [counterId, items] of grouped.entries()) {
    const required = Number(requiredByCounter.get(counterId) || 0);
    if (required <= 0) {
      continue;
    }

    const sorted = [...items].sort((a, b) => {
      const pA = Number(a.priority || 2);
      const pB = Number(b.priority || 2);
      if (pA !== pB) return pA - pB;

      const qA = Number(queueSizeByCounter.get(String(a.counterId)) || 0);
      const qB = Number(queueSizeByCounter.get(String(b.counterId)) || 0);
      if (qA !== qB) return qB - qA;

      const tA = new Date(a.startTime || 0).getTime();
      const tB = new Date(b.startTime || 0).getTime();
      return tA - tB;
    });

    trimmed.push(...sorted.slice(0, required));
  }

  return trimmed;
}

function rebalanceAllocationsToDemand(allocations, requiredByCounter = new Map(), queueSizeByCounter = new Map()) {
  if (!Array.isArray(allocations) || allocations.length === 0) {
    return [];
  }

  const activeCounters = Array.from(requiredByCounter.entries())
    .filter(([, required]) => Number(required || 0) > 0)
    .map(([counterId, required]) => ({
      counterId: String(counterId),
      required: Number(required || 0),
      queue: Number(queueSizeByCounter.get(String(counterId)) || 0),
    }));

  if (activeCounters.length === 0) {
    return [];
  }

  // Highest demand counters are prioritized first.
  activeCounters.sort((a, b) => {
    if (a.queue !== b.queue) return b.queue - a.queue;
    return b.required - a.required;
  });

  const staffPool = [...allocations]
    .filter((item) => String(item.staffId || '').trim())
    .sort((a, b) => {
      const pA = Number(a.priority || 2);
      const pB = Number(b.priority || 2);
      if (pA !== pB) return pA - pB;

      const qA = Number(queueSizeByCounter.get(String(a.counterId)) || 0);
      const qB = Number(queueSizeByCounter.get(String(b.counterId)) || 0);
      if (qA !== qB) return qB - qA;

      const tA = new Date(a.startTime || 0).getTime();
      const tB = new Date(b.startTime || 0).getTime();
      return tA - tB;
    });

  const byCounter = new Map();
  activeCounters.forEach((counter) => byCounter.set(counter.counterId, []));

  const nextStaff = () => {
    if (staffPool.length === 0) return null;
    return staffPool.shift() || null;
  };

  // Stage 1: baseline coverage (1 staff per active counter when possible).
  for (const counter of activeCounters) {
    if (staffPool.length === 0) break;
    const item = nextStaff();
    if (!item) break;
    byCounter.get(counter.counterId).push({
      ...item,
      counterId: counter.counterId,
      reason: `${item.reason || 'Optimized allocation'} (balanced baseline coverage)`,
    });
  }

  // Stage 2: fill additional demand up to required staff per counter.
  while (staffPool.length > 0) {
    let target = null;
    let maxDeficit = 0;

    for (const counter of activeCounters) {
      const assigned = byCounter.get(counter.counterId).length;
      const deficit = counter.required - assigned;
      if (deficit > maxDeficit) {
        maxDeficit = deficit;
        target = counter;
      }
    }

    if (!target || maxDeficit <= 0) {
      break;
    }

    const item = nextStaff();
    if (!item) break;
    byCounter.get(target.counterId).push({
      ...item,
      counterId: target.counterId,
      reason: `${item.reason || 'Optimized allocation'} (balanced demand fill)`,
    });
  }

  return activeCounters.flatMap((counter) => byCounter.get(counter.counterId));
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
