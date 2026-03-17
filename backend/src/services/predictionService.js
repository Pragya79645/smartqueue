const axios = require('axios');
const logger = require('../utils/logger');

// Python AI Engine endpoint for LSTM predictions
const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8001';
const PREDICTION_TIMEOUT_MS = parseInt(process.env.AI_PREDICTION_TIMEOUT_MS || '15000', 10);
const PREDICTION_RETRY_COUNT = parseInt(process.env.AI_PREDICTION_RETRY_COUNT || '2', 10);
const TRANSIENT_CODES = new Set(['ECONNREFUSED', 'ECONNRESET', 'ECONNABORTED', 'ETIMEDOUT']);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isTransientError(error) {
  return TRANSIENT_CODES.has(error?.code);
}

async function requestPredictionWithRetry(payload) {
  let lastError = null;

  for (let attempt = 1; attempt <= PREDICTION_RETRY_COUNT + 1; attempt++) {
    try {
      return await axios.post(`${PYTHON_API_URL}/predict`, payload, {
        timeout: PREDICTION_TIMEOUT_MS
      });
    } catch (error) {
      lastError = error;
      const canRetry = isTransientError(error) && attempt <= PREDICTION_RETRY_COUNT;

      if (!canRetry) {
        throw error;
      }

      const backoffMs = attempt * 750;
      logger.warn(
        `Prediction attempt ${attempt} failed (${error.code}). Retrying in ${backoffMs}ms.`
      );
      await sleep(backoffMs);
    }
  }

  throw lastError;
}

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

    // Call Python LSTM service (with retry for transient AI-engine startup/network errors)
    const response = await requestPredictionWithRetry({
      data: historicalData,
      minutes_ahead: minutesAhead
    });

    logger.info(`Prediction completed: ${minutesAhead} minutes ahead`);
    return response.data;

  } catch (error) {
    if (isTransientError(error)) {
      logger.warn(`Python prediction service unavailable (${error.code}). Using mock prediction.`);
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
  const confidence = 0.75;
  const currentSize = historicalData[historicalData.length - 1]?.queueSize || 0;

  return {
    success: true,
    predicted_queue: predictedSize,
    confidence,
    minutes_ahead: minutesAhead,
    current_queue: currentSize,
    change: predictedSize - currentSize,
    rush_level: predictedSize > 15 ? 'high' : predictedSize > 8 ? 'medium' : 'low',
    recommendation: 'Fallback prediction in use. Verify AI Engine availability for LSTM output.',
    trend: predictedSize >= currentSize ? 'increasing' : 'decreasing',
    predictions: historicalData.map((d, i) => ({
      counterId: d.counterId,
      currentSize: d.queueSize,
      predictedSize: predictedSize + (i % 3 - 1), // Add slight variation
      confidence,
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
