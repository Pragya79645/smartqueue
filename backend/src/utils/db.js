const mongoose = require('mongoose');
const logger = require('./logger');

// Avoid long request hangs when DB is unavailable.
mongoose.set('bufferCommands', false);

const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/queue-balancer';
  const maxRetries = Number(process.env.MONGO_RETRY_MAX || 3);
  const retryDelayMs = Number(process.env.MONGO_RETRY_DELAY_MS || 2000);
  const serverSelectionTimeoutMS = Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 4000);

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      await mongoose.connect(mongoURI, {
        serverSelectionTimeoutMS,
      });

      logger.info('MongoDB connected successfully');
      console.log('✅ MongoDB connected');
      return true;
    } catch (error) {
      lastError = error;
      logger.error(`MongoDB connection failed (attempt ${attempt}/${maxRetries}):`, error);

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  const isProd = process.env.NODE_ENV === 'production';
  console.error('❌ MongoDB connection failed:', lastError.message);

  if (isProd) {
    process.exit(1);
  }

  logger.warn('Starting server without MongoDB connection (development mode)');
  return false;
};

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB error:', err);
});

module.exports = connectDB;
