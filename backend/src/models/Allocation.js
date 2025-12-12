const mongoose = require('mongoose');

const allocationSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now
  },
  allocations: [{
    staffId: {
      type: String,
      required: true
    },
    staffName: {
      type: String,
      required: true
    },
    counterId: {
      type: Number,
      required: true
    },
    priority: {
      type: Number,
      default: 1
    },
    reason: {
      type: String,
      default: ''
    }
  }],
  totalScore: {
    type: Number,
    default: 0
  },
  predictedLoad: {
    type: Object,
    default: {}
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'completed'],
    default: 'pending'
  },
  appliedBy: {
    type: String,
    default: 'system'
  }
}, {
  timestamps: true
});

allocationSchema.index({ timestamp: -1 });
allocationSchema.index({ status: 1 });

module.exports = mongoose.model('Allocation', allocationSchema);
