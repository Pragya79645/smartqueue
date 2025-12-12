const mongoose = require('mongoose');
const logger = require('./logger');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/queue-balancer';
    
    await mongoose.connect(mongoURI);
    
    logger.info('MongoDB connected successfully');
    console.log('✅ MongoDB connected');
  } catch (error) {
    logger.error('MongoDB connection failed:', error);
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB error:', err);
});

module.exports = connectDB;
