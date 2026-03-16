const axios = require('axios');
const logger = require('../utils/logger');

// Python AI Engine endpoint for LSTM predictions
const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8001';

/**
 * Get queue predictions using LSTM model
 * @param {Array} historicalData - Historical queue data
 * @param {number} minutesAhead - Minutes to predict ahead (default: 15)
 * @returns {Promise<Object>} Prediction result
 */
exports.predictQueueLoad = async (historicalData, minutesAhead = 15) => {
  try {
    if (!historicalData || historicalData.length < 10) {
      throw new Error('Insufficient historical data for prediction');
    }

    // Call Python LSTM service
    const response = await axios.post(`${PYTHON_API_URL}/predict`, {
      data: historicalData,
      minutes_ahead: minutesAhead
    }, {
      timeout: 5000
    });

    logger.info(`Prediction completed: ${minutesAhead} minutes ahead`);
    return response.data;

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      logger.error('Python prediction service not available');
      // Return mock prediction
      return mockPrediction(historicalData, minutesAhead);
    }
    
    logger.error('Prediction service error:', error.message);
    throw error;
  }
};

/**
 * Mock prediction for development/testing
 */
function mockPrediction(historicalData, minutesAhead) {
  // Simple moving average prediction as fallback
  const recent = historicalData.slice(-5);
  const avgLoad = recent.reduce((sum, d) => sum + d.queueSize, 0) / recent.length;
  
  // Add some variance based on time of day
  const hour = new Date().getHours();
  let multiplier = 1.0;
  
  // Peak hours: 10-12, 14-16
  if ((hour >= 10 && hour <= 12) || (hour >= 14 && hour <= 16)) {
    multiplier = 1.3;
  }
  // Low hours: 8-9, 13-14, 16-18
  else if ((hour >= 8 && hour < 10) || hour === 13 || (hour >= 16 && hour <= 18)) {
    multiplier = 0.8;
  }

  const predictedSize = Math.round(avgLoad * multiplier);

  return {
    success: true,
    predictions: historicalData.map((d, i) => ({
      counterId: d.counterId,
      currentSize: d.queueSize,
      predictedSize: predictedSize + (i % 3 - 1), // Add slight variation
      confidence: 0.75,
      minutesAhead
    })),
    algorithm: 'mock-moving-average',
    timestamp: new Date().toISOString()
  };
}

/**
 * Detect if queue is trending up (potential rush)
 */
exports.detectRushTrend = (recentData) => {
  if (recentData.length < 5) {
    return { isRush: false, confidence: 0 };
  }

  // Calculate trend
  let increases = 0;
  for (let i = 1; i < recentData.length; i++) {
    if (recentData[i].queueSize > recentData[i - 1].queueSize) {
      increases++;
    }
  }

  const trendPercentage = increases / (recentData.length - 1);
  const avgSize = recentData.reduce((sum, d) => sum + d.queueSize, 0) / recentData.length;

  const isRush = trendPercentage > 0.6 && avgSize > 8;
  const confidence = trendPercentage;

  return {
    isRush,
    confidence,
    avgSize,
    trend: trendPercentage > 0.6 ? 'increasing' : trendPercentage < 0.4 ? 'decreasing' : 'stable'
  };
};

/**
 * Calculate peak hours based on historical data
 */
exports.analyzePeakHours = (historicalData) => {
  const hourlyLoad = {};

  // Group by hour
  historicalData.forEach(record => {
    const hour = new Date(record.timestamp).getHours();
    if (!hourlyLoad[hour]) {
      hourlyLoad[hour] = { total: 0, count: 0 };
    }
    hourlyLoad[hour].total += record.queueSize;
    hourlyLoad[hour].count += 1;
  });

  // Calculate averages
  const hourlyAvg = {};
  Object.keys(hourlyLoad).forEach(hour => {
    hourlyAvg[hour] = hourlyLoad[hour].total / hourlyLoad[hour].count;
  });

  // Find peak hours (top 3)
  const sorted = Object.entries(hourlyAvg)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return {
    peakHours: sorted.map(([hour, avg]) => ({
      hour: parseInt(hour),
      avgLoad: parseFloat(avg.toFixed(2))
    })),
    totalAnalyzed: historicalData.length
  };
};
