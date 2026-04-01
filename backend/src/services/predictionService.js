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

function buildPredictionServiceError(error) {
  const upstreamStatus = error?.response?.status;
  const upstreamMessage = error?.response?.data?.error || error?.response?.data?.message;

  const wrapped = new Error(
    upstreamMessage || error?.message || 'Prediction service request failed'
  );
  wrapped.code = error?.code || 'PREDICTION_SERVICE_ERROR';
  wrapped.upstreamStatus = upstreamStatus;
  wrapped.isServiceUnavailable = isTransientError(error) || upstreamStatus === 502 || upstreamStatus === 503 || upstreamStatus === 504;
  return wrapped;
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
    const wrappedError = buildPredictionServiceError(error);
    logger.error('Prediction service error:', wrappedError.message);
    throw wrappedError;
  }
};

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
