/**
 * ✅ PRODUCTION-GRADE: Input Sanitization Utilities
 * Provides consistent sanitization for user inputs
 */

/**
 * Sanitize string input - removes/escapes dangerous characters
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return '';
  return str
    .trim()
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '') // Strip HTML tags
    .slice(0, 5000); // Max length
};

/**
 * Sanitize food description
 */
const sanitizeFood = (food) => {
  return sanitizeString(food).slice(0, 200);
};

/**
 * Validate and sanitize AI message
 */
const sanitizeMessage = (message) => {
  const sanitized = sanitizeString(message);
  if (sanitized.length < 1 || sanitized.length > 2000) {
    throw new Error('Message must be 1-2000 characters');
  }
  return sanitized;
};

module.exports = {
  sanitizeString,
  sanitizeFood,
  sanitizeMessage
};
