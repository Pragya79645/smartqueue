const axios = require('axios');
const logger = require('../utils/logger');

// Python AI Engine URL
const AI_ENGINE_URL = process.env.PYTHON_API_URL || 'http://localhost:8001';

/**
 * GET /ai/analyze - Get comprehensive AI analysis
 * Forwards request to AI Engine and returns JSON response
 */
exports.getAiAnalysis = async (req, res) => {
  try {
    const { minutesAhead = 15 } = req.query;
    
    // Get historical data from database (last 60 records)
    const QueueRecord = require('../models/QueueRecord');
    const historicalData = await QueueRecord.find()
      .sort({ timestamp: -1 })
      .limit(60);
    
    // Get current counter states
    const currentCounters = await QueueRecord.aggregate([
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: '$counterId',
          latestData: { $first: '$$ROOT' }
        }
      },
      { $replaceRoot: { newRoot: '$latestData' } }
    ]);
    
    // Prepare AI request
    const aiRequest = {
      historical_data: historicalData.reverse(),
      current_counters: currentCounters.map(c => ({
        counterId: c.counterId,
        queueSize: c.queueSize,
        averageWaitTime: c.averageWaitTime
      })),
      minutes_ahead: parseInt(minutesAhead)
    };
    
    // Call AI Engine
    const response = await axios.post(
      `${AI_ENGINE_URL}/ai/analyze`,
      aiRequest,
      { timeout: 10000 }
    );
    
    logger.info('AI analysis completed successfully');
    
    res.json({
      success: true,
      ...response.data
    });
    
  } catch (error) {
    logger.error('AI analysis error:', error.message);
    
    // Fallback response if AI engine is unavailable
    if (error.code === 'ECONNREFUSED') {
      return res.json({
        success: false,
        error: 'AI Engine unavailable',
        fallback: true,
        analysis: {
          prediction: {
            predicted_queue: 0,
            confidence: 0,
            rush_level: 'unknown',
            recommendation: 'AI Engine offline - cannot generate predictions'
          }
        }
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to get AI analysis',
      message: error.message
    });
  }
};

/**
 * POST /ai/detection - Process queue detection data
 * Receives detection data and forwards to AI Engine for enrichment
 */
exports.processDetection = async (req, res) => {
  try {
    const { counters, timestamp, camera_id } = req.body;
    
    if (!counters || !Array.isArray(counters)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: counters array required'
      });
    }
    
    // Forward to AI Engine for enrichment
    const response = await axios.post(
      `${AI_ENGINE_URL}/queue/detection`,
      { counters, timestamp, camera_id },
      { timeout: 5000 }
    );
    
    logger.info(`Processed detection data for ${counters.length} counters`);
    
    res.json({
      success: true,
      ...response.data
    });
    
  } catch (error) {
    logger.error('Detection processing error:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to process detection data'
    });
  }
};

/**
 * POST /ai/predict-enhanced - Enhanced prediction with rush analysis
 */
exports.getEnhancedPrediction = async (req, res) => {
  try {
    const { counterId, minutesAhead = 15 } = req.body;
    
    // Get historical data
    const QueueRecord = require('../models/QueueRecord');
    let query = {};
    if (counterId) {
      query.counterId = parseInt(counterId);
    }
    
    const historicalData = await QueueRecord.find(query)
      .sort({ timestamp: -1 })
      .limit(60);
    
    if (historicalData.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient historical data'
      });
    }
    
    // Call AI Engine prediction
    const response = await axios.post(
      `${AI_ENGINE_URL}/predict`,
      {
        data: historicalData.reverse(),
        minutes_ahead: minutesAhead
      },
      { timeout: 5000 }
    );
    
    // Enhance with rush level determination
    const predicted = response.data.predicted_queue || 0;
    let rushLevel = 'low';
    let recommendation = 'Normal staffing sufficient';
    
    if (predicted > 15) {
      rushLevel = 'high';
      recommendation = 'High demand expected. Allocate maximum staff.';
    } else if (predicted > 8) {
      rushLevel = 'medium';
      recommendation = 'Moderate rush expected. Ensure adequate coverage.';
    }
    
    res.json({
      success: true,
      prediction: {
        ...response.data,
        rush_level: rushLevel,
        recommendation: recommendation,
        timeframe: `Next ${minutesAhead} minutes`
      }
    });
    
  } catch (error) {
    logger.error('Enhanced prediction error:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get enhanced prediction'
    });
  }
};

/**
 * GET /ai/health - Check AI Engine health
 */
exports.checkAiHealth = async (req, res) => {
  try {
    const response = await axios.get(
      `${AI_ENGINE_URL}/health`,
      { timeout: 3000 }
    );
    
    res.json({
      success: true,
      ai_engine_status: 'online',
      ...response.data
    });
    
  } catch (error) {
    res.json({
      success: false,
      ai_engine_status: 'offline',
      error: error.message
    });
  }
};

/**
 * POST /ai/process-frame - Process video frame for real-time detection
 */
exports.processFrame = async (req, res) => {
  try {
    const { frame, camera_id, counter_zones } = req.body;
    
    if (!frame) {
      return res.status(400).json({
        success: false,
        error: 'Missing frame data'
      });
    }
    
    // Forward frame to AI Engine for detection
    const response = await axios.post(
      `${AI_ENGINE_URL}/detect-frame`,
      { frame, camera_id, counter_zones },
      { 
        timeout: 10000,
        maxContentLength: 10 * 1024 * 1024, // 10MB max
        maxBodyLength: 10 * 1024 * 1024
      }
    );
    
    // Optionally save detection results to database
    if (response.data.success && response.data.counters) {
      const QueueRecord = require('../models/QueueRecord');
      
      // Save each counter's queue size
      const savePromises = Object.entries(response.data.counters).map(([counterId, info]) => {
        return QueueRecord.create({
          counterId: parseInt(counterId),
          queueSize: info.count,
          averageWaitTime: info.count * 3, // Estimate: 3 minutes per person
          timestamp: new Date()
        });
      });
      
      await Promise.all(savePromises).catch(err => {
        logger.error('Failed to save queue records:', err.message);
      });
    }
    
    logger.info(`Frame processed: ${response.data.total_people} people detected`);
    
    res.json({
      success: true,
      ...response.data
    });
    
  } catch (error) {
    const statusCode = error.response?.status || 500;
    const engineError = error.response?.data?.error;
    const engineMessage = error.response?.data?.message;
    const details = engineError || engineMessage || error.message;

    logger.error(`Frame processing error (${statusCode}): ${details}`);
    
    // Return error but don't crash
    res.status(statusCode).json({
      success: false,
      error: 'Failed to process frame',
      message: details
    });
  }
};
