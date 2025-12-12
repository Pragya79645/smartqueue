const mongoose = require('mongoose');

const queueRecordSchema = new mongoose.Schema({
  counterId: {
    type: Number,
    required: true
  },
  queueSize: {
    type: Number,
    required: true,
    default: 0
  },
  predictedSize: {
    type: Number,
    default: null
  },
  predictionTime: {
    type: Number, // minutes ahead
    default: 15
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  averageWaitTime: {
    type: Number, // in minutes
    default: 0
  },
  status: {
    type: String,
    enum: ['normal', 'busy', 'critical'],
    default: 'normal'
  }
}, {
  timestamps: true
});

// Index for faster queries
queueRecordSchema.index({ counterId: 1, timestamp: -1 });

module.exports = mongoose.model('QueueRecord', queueRecordSchema);
