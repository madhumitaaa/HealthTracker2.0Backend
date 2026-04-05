/**
 * ✅ PRODUCTION-GRADE: Structured Logging with Pino
 * Provides consistent JSON-formatted logs with request context
 */

const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV === 'production'
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
          }
        }
});

module.exports = logger;
