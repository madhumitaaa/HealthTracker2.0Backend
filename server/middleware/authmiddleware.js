/**
 * ✅ PRODUCTION-GRADE: Authentication Middleware
 * Supports both accessToken (short-lived) and fallback to original token for frontend compatibility
 */

const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn({ endpoint: req.path }, 'No auth token provided');
    return res.status(401).json({ 
      status: 'error',
      message: 'No token provided',
      details: 'Authorization header missing or invalid'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    // ✅ First, try to verify as accessToken (short-lived)
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256']
    });

    // ✅ Check if token is revoked
    if (req.app.locals.revokedTokens && req.app.locals.revokedTokens.has(token)) {
      logger.info({ userId: decoded.userId }, 'Revoked token used');
      return res.status(401).json({
        status: 'error',
        message: 'Token has been revoked',
        details: 'Please login again'
      });
    }

    req.userId = decoded.userId;
    req.tokenType = decoded.type || 'legacy'; // 'access' or 'legacy'
    req.token = token;

    next();
  } catch (err) {
    logger.warn({ error: err.message }, 'Token verification failed');

    // ✅ BACKWARD COMPATIBILITY: If token verification fails, still try old format
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid or expired token',
        details: 'Please login again'
      });
    }

    return res.status(401).json({
      status: 'error',
      message: 'Authentication failed',
      details: err.message
    });
  }
};


