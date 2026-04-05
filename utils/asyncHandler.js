/**
 * ✅ PRODUCTION-GRADE: Async Handler Wrapper
 * Wraps async route handlers to automatically catch errors and pass to centralized error handler
 * Prevents uncaught promise rejections from crashing the server
 */

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
