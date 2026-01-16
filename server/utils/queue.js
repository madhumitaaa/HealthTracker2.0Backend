/**
 * ✅ SYNCHRONOUS MODE: Queue Setup
 * Using synchronous processing for now (Redis removed)
 * Can be re-integrated later with BullMQ when needed
 */

const logger = require('./logger');

// Stub functions for queue operations (not used in sync mode)
const getQueue = () => null;

/**
 * Check if Redis is available
 * Returns false since we're not using Redis
 */
const isRedisAvailable = async () => {
  return false;
};

/**
 * Enqueue AI chat job (not used in sync mode)
 */
const enqueueAiChat = async (userId, message) => {
  return null;
};

/**
 * Enqueue weekly report job (not used in sync mode)
 */
const enqueueWeeklyReport = async (userId) => {
  return null;
};

/**
 * Get job status (not used in sync mode)
 */
const getJobStatus = async (jobId) => {
  return { status: 'not-available' };
};

/**
 * Clean up old jobs (not used in sync mode)
 */
const cleanupOldJobs = async () => {
  // No-op in sync mode
};

module.exports = {
  getQueue,
  enqueueAiChat,
  enqueueWeeklyReport,
  getJobStatus,
  cleanupOldJobs,
  isRedisAvailable
};
