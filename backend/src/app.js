const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const logger = require('./utils/logger');

// Import routes
const queueRoutes = require('./routes/queueRoutes');
const staffRoutes = require('./routes/staffRoutes');
const allocationRoutes = require('./routes/allocationRoutes');
const whatsappRoutes = require('./routes/whatsappRoutes');
const aiRoutes = require('./routes/aiRoutes');

const app = express();

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
// Increase body size limits to accept larger video/frame payloads
app.use(express.json({ limit: '20mb' })); // Parse JSON bodies (up from default 100kb)
app.use(express.urlencoded({ extended: true, limit: '20mb' })); // Parse URL-encoded bodies

// HTTP request logger
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
app.use('/api/queue', queueRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/allocate', allocationRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/ai', aiRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'AI Queue Load Balancer API',
    version: '1.0.0',
    endpoints: {
      queue: '/api/queue',
      staff: '/api/staff',
      allocation: '/api/allocate',
      whatsapp: '/api/whatsapp',
      ai: '/api/ai'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

module.exports = app;
