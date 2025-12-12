const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
  staffId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  skills: [{
    type: String,
    enum: ['general', 'loan', 'account', 'cashier', 'inquiry', 'premium']
  }],
  availability: {
    type: String,
    enum: ['available', 'busy', 'break', 'offline'],
    default: 'available'
  },
  currentCounter: {
    type: Number,
    default: null
  },
  performanceScore: {
    type: Number,
    default: 100,
    min: 0,
    max: 100
  },
  shiftStart: {
    type: String, // HH:MM format
    default: '09:00'
  },
  shiftEnd: {
    type: String, // HH:MM format
    default: '17:00'
  }
}, {
  timestamps: true
});

staffSchema.index({ staffId: 1 });
staffSchema.index({ availability: 1 });

module.exports = mongoose.model('Staff', staffSchema);
