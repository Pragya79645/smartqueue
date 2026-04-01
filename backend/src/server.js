require('dotenv').config();
const app = require('./app');
const connectDB = require('./utils/db');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5001;

const startServer = async () => {
  try {
    await connectDB();
  } catch (error) {
    logger.error('Failed to connect to MongoDB before startup:', error);
  }

  const server = app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  });
};

startServer();

// Graceful shutdown
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
