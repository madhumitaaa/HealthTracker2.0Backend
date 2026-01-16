/**
 * ✅ PRODUCTION-GRADE: Main Server
 * Includes Helmet security headers, structured logging, health checks, and centralized error handling
 */

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const logger = require('./utils/logger');

// Routes
const entriesRoute = require('./routes/entries');
const authRoute = require('./routes/auth');
const aiRoute = require('./routes/ai');

const app = express();

// ✅ PRODUCTION: Initialize revoked tokens in memory (for single-server deployments)
// For multi-server setups, use Redis or MongoDB for token revocation list
app.locals.revokedTokens = new Set();

// ===== MIDDLEWARE =====

// ✅ PRODUCTION: Security headers with Helmet
app.use(helmet({
  contentSecurityPolicy: false, // Can be configured based on frontend needs
  crossOriginEmbedderPolicy: false
}));

// ✅ PRODUCTION: Hardened CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({
  limit: '10mb' // Limit payload size
}));

// ✅ PRODUCTION: Request logging middleware
app.use((req, res, next) => {
  logger.info({
    method: req.method,
    endpoint: req.path,
    userId: req.headers.authorization?.split(' ')?.[1] ? 'authenticated' : 'anonymous'
  }, `${req.method} ${req.path}`);
  next();
});

// ===== HEALTH CHECK =====
// ✅ PRODUCTION: Extended health check with MongoDB and Redis status
app.get('/api/health', async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

    // Check Redis availability (optional)
    let redisStatus = 'not-configured';
    try {
      const { isRedisAvailable } = require('./utils/queue');
      redisStatus = await isRedisAvailable() ? 'connected' : 'disconnected';
    } catch {
      redisStatus = 'unavailable';
    }

    res.json({
      status: 'success',
      message: 'Server is running',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: dbStatus,
        redis: redisStatus
      },
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (err) {
    logger.error({ error: err.message }, 'Health check failed');
    res.status(503).json({
      status: 'error',
      message: 'Health check failed',
      error: err.message
    });
  }
});

// ===== ROUTES =====
app.use('/auth', authRoute);
app.use('/entries', entriesRoute);
app.use('/ai', aiRoute);

// ===== 404 HANDLER =====
app.use((req, res) => {
  logger.warn({ path: req.path, method: req.method }, 'Route not found');
  res.status(404).json({
    status: 'error',
    message: 'Route not found',
    path: req.path
  });
});

// ===== CENTRALIZED ERROR HANDLER =====
// ✅ PRODUCTION: Catches all errors and returns consistent response format
app.use((err, req, res, next) => {
  const errorId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  logger.error({
    errorId,
    endpoint: req.path,
    method: req.method,
    userId: req.userId || 'anonymous',
    error: err.message,
    stack: err.stack
  }, 'Unhandled error');

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const details = Object.entries(err.errors).map(([field, err]) => ({
      field,
      message: err.message
    }));
    return res.status(400).json({
      status: 'error',
      message: 'Validation error',
      errorId,
      details
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(409).json({
      status: 'error',
      message: `Duplicate ${field}`,
      errorId,
      field
    });
  }

  // Mongoose cast error
  if (err.name === 'CastError') {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid ID format',
      errorId
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      status: 'error',
      message: 'Invalid token',
      errorId
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      status: 'error',
      message: 'Token expired',
      errorId
    });
  }

  // Default error response
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    status: 'error',
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    errorId,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// ===== DB + SERVER =====
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    logger.info({ port: PORT }, 'MongoDB connected');
    app.listen(PORT, () => {
      logger.info({ port: PORT }, `Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    logger.error({ error: err.message }, 'Failed to connect to MongoDB');
    process.exit(1);
  });

// ===== GRACEFUL SHUTDOWN =====
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  mongoose.connection.close(() => {
    logger.info('MongoDB connection closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  mongoose.connection.close(() => {
    logger.info('MongoDB connection closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error({ error: err.message, stack: err.stack }, 'Uncaught exception');
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled rejection');
});
