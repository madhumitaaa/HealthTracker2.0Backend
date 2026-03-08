/**
 * ✅ FIXED Authentication Middleware
 * Supports both userId and id in JWT payload
 */

const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn({ endpoint: req.path }, 'No auth token provided');
    return res.status(401).json({
      status: 'error',
      message: 'No token provided'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256']
    });

    // ✅ FIX: support both payload formats
    req.userId = decoded.userId || decoded.id;

    if (!req.userId) {
      logger.error('Token payload missing userId');
      return res.status(401).json({
        status: 'error',
        message: 'Invalid token payload'
      });
    }

    // Optional revoked token check
    if (req.app.locals.revokedTokens && req.app.locals.revokedTokens.has(token)) {
      return res.status(401).json({
        status: 'error',
        message: 'Token revoked'
      });
    }

    req.token = token;

    next();

  } catch (err) {
    logger.warn({ error: err.message }, 'Token verification failed');

    return res.status(401).json({
      status: 'error',
      message: 'Invalid or expired token'
    });
  }
};
