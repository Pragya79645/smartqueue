const QueueRecord = require('../models/QueueRecord');
const mongoose = require('mongoose');
const predictionService = require('../services/predictionService');
const logger = require('../utils/logger');

// GET /queue/live - Get current live queue data
exports.getLiveQueue = async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        success: true,
        count: 0,
        data: [],
        timestamp: new Date().toISOString(),
        warning: 'MongoDB is currently disconnected. Returning empty live queue data.'
      });
    }

    // Get latest queue data for all counters
    const counters = await QueueRecord.aggregate([
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
      },
      {
        $sort: { counterId: 1 }
      }
    ]);

    res.json({
      success: true,
      count: counters.length,
      data: counters,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching live queue:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch live queue data'
    });
  }
};

// POST /queue/update - Update queue data (from CV detection)
exports.updateQueue = async (req, res) => {
  try {
    const { counterId, queueSize, predictedSize, predictionTime, averageWaitTime } = req.body;

    if (!counterId || queueSize === undefined) {
      return res.status(400).json({
        success: false,
        error: 'counterId and queueSize are required'
      });
    }

    // Determine status based on queue size
    let status = 'normal';
    if (queueSize > 15) status = 'critical';
    else if (queueSize > 8) status = 'busy';

    const queueRecord = new QueueRecord({
      counterId,
      queueSize,
      predictedSize: predictedSize || null,
      predictionTime: predictionTime || 15,
      averageWaitTime: averageWaitTime || queueSize * 3, // Estimate 3 min per person
      status
    });

    await queueRecord.save();

    logger.info(`Queue updated for counter ${counterId}: ${queueSize} people`);

    res.status(201).json({
      success: true,
      data: queueRecord,
      message: 'Queue data updated successfully'
    });
  } catch (error) {
    logger.error('Error updating queue:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update queue data'
    });
  }
};

// POST /queue/update/batch - Batch update for multiple counters
exports.batchUpdateQueue = async (req, res) => {
  try {
    const { queues } = req.body;

    if (!Array.isArray(queues) || queues.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'queues array is required'
      });
    }

    const records = queues.map(q => {
      let status = 'normal';
      if (q.queueSize > 15) status = 'critical';
      else if (q.queueSize > 8) status = 'busy';

      return {
        counterId: q.counterId,
        queueSize: q.queueSize,
        predictedSize: q.predictedSize || null,
        predictionTime: q.predictionTime || 15,
        averageWaitTime: q.averageWaitTime || q.queueSize * 3,
        status,
        timestamp: new Date()
      };
    });

    await QueueRecord.insertMany(records);

    logger.info(`Batch queue update: ${records.length} counters`);

    res.status(201).json({
      success: true,
      count: records.length,
      message: 'Batch queue data updated successfully'
    });
  } catch (error) {
    logger.error('Error in batch queue update:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update queue data'
    });
  }
};

// GET /queue/history - Get historical queue data
exports.getQueueHistory = async (req, res) => {
  try {
    const { counterId, startDate, endDate, limit = 100 } = req.query;

    let query = {};
    
    if (counterId) {
      query.counterId = parseInt(counterId);
    }

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const history = await QueueRecord.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      count: history.length,
      data: history
    });
  } catch (error) {
    logger.error('Error fetching queue history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch queue history'
    });
  }
};

// GET /queue/stats - Get queue statistics
exports.getQueueStats = async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const stats = await QueueRecord.aggregate([
      {
        $match: { timestamp: { $gte: since } }
      },
      {
        $group: {
          _id: '$counterId',
          avgQueueSize: { $avg: '$queueSize' },
          maxQueueSize: { $max: '$queueSize' },
          minQueueSize: { $min: '$queueSize' },
          totalRecords: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.json({
      success: true,
      period: `Last ${hours} hours`,
      data: stats
    });
  } catch (error) {
    logger.error('Error fetching queue stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch queue statistics'
    });
  }
};

// DELETE /queue/history - Clean old data (maintenance)
exports.cleanOldData = async (req, res) => {
  try {
    const { days = 30 } = req.body;
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await QueueRecord.deleteMany({
      timestamp: { $lt: cutoffDate }
    });

    logger.info(`Cleaned ${result.deletedCount} old queue records`);

    res.json({
      success: true,
      deletedCount: result.deletedCount,
      message: `Deleted records older than ${days} days`
    });
  } catch (error) {
    logger.error('Error cleaning old data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clean old data'
    });
  }
};

// GET /queue/predict - Get queue predictions
exports.getPredictions = async (req, res) => {
  try {
    const { counterId, minutesAhead = 15 } = req.query;
    const parsedMinutesAhead = parseInt(minutesAhead, 10);

    if (Number.isNaN(parsedMinutesAhead) || parsedMinutesAhead <= 0) {
      return res.status(400).json({
        success: false,
        error: 'minutesAhead must be a positive integer'
      });
    }

    // Get historical data for prediction
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
        error: 'Insufficient historical data for prediction (need at least 10 records)'
      });
    }

    // Reverse to chronological order
    historicalData.reverse();

    // Get predictions from AI service
    const prediction = await predictionService.predictQueueLoad(
      historicalData,
      parsedMinutesAhead
    );

    // Detect rush trend
    const rushTrend = predictionService.detectRushTrend(historicalData.slice(-10));

    res.json({
      success: true,
      prediction: prediction,
      rushTrend: rushTrend,
      historicalDataPoints: historicalData.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error getting predictions:', error);
    const status = error?.isServiceUnavailable
      ? 503
      : (error?.upstreamStatus >= 400 && error?.upstreamStatus < 600 ? error.upstreamStatus : 500);

    res.status(status).json({
      success: false,
      error: error?.message || 'Failed to get predictions'
    });
  }
};
