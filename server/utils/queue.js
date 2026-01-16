/**
 * ✅ PRODUCTION-GRADE: BullMQ Queue Setup
 * Manages async job queue for AI tasks with Redis
 * Implements exponential backoff and retries
 */

const { Queue, Worker } = require('bullmq');
const redis = require('redis');
const logger = require('./logger');

// Initialize Redis connection
const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_DB || 0,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

redisClient.on('error', (err) => {
  logger.error({ error: err }, 'Redis client error');
});

redisClient.on('connect', () => {
  logger.info('Redis connected successfully');
});

// Create queue for AI tasks
const aiQueue = new Queue('ai-tasks', {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: process.env.REDIS_DB || 0
  }
});

// Queue configuration
const queueConfig = {
  defaultJobOptions: {
    // ✅ PRODUCTION: Exponential backoff retry strategy
    attempts: parseInt(process.env.AI_JOB_MAX_ATTEMPTS || '3'),
    backoff: {
      type: 'exponential',
      delay: 2000 // Start with 2 seconds, doubles each attempt
    },
    removeOnComplete: true, // Remove completed jobs after 24 hours
    removeOnFail: false // Keep failed jobs for debugging
  }
};

/**
 * Get queue instance (for enqueueing)
 */
const getQueue = () => aiQueue;

/**
 * Check if Redis is available
 */
const isRedisAvailable = async () => {
  try {
    const client = redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: process.env.REDIS_DB || 0
    });
    await client.connect();
    await client.ping();
    await client.quit();
    return true;
  } catch (err) {
    logger.warn({ error: err.message }, 'Redis not available');
    return false;
  }
};

/**
 * Enqueue AI chat job
 */
const enqueueAiChat = async (userId, message) => {
  try {
    const job = await aiQueue.add(
      'chat',
      {
        userId,
        message,
        type: 'chat'
      },
      {
        ...queueConfig.defaultJobOptions,
        jobId: `chat-${userId}-${Date.now()}` // Unique job ID
      }
    );

    logger.info({ jobId: job.id, userId }, 'AI chat job enqueued');
    return job.id;
  } catch (err) {
    logger.error({ error: err, userId }, 'Failed to enqueue AI chat job');
    throw err;
  }
};

/**
 * Enqueue weekly report job
 */
const enqueueWeeklyReport = async (userId) => {
  try {
    const job = await aiQueue.add(
      'weekly-report',
      {
        userId,
        type: 'weekly-report'
      },
      {
        ...queueConfig.defaultJobOptions,
        jobId: `report-${userId}-${Date.now()}`
      }
    );

    logger.info({ jobId: job.id, userId }, 'Weekly report job enqueued');
    return job.id;
  } catch (err) {
    logger.error({ error: err, userId }, 'Failed to enqueue weekly report job');
    throw err;
  }
};

/**
 * Get job status and result
 */
const getJobStatus = async (jobId) => {
  try {
    const job = await aiQueue.getJob(jobId);
    if (!job) {
      return { status: 'not-found' };
    }

    const state = await job.getState();
    const progress = job.progress();
    const data = job.data;
    const result = job.returnvalue;
    const failedReason = job.failedReason;
    const attempts = job.attemptsMade;

    return {
      id: job.id,
      status: state,
      progress,
      result,
      failedReason,
      attempts,
      data: { userId: data.userId, type: data.type }
    };
  } catch (err) {
    logger.error({ error: err, jobId }, 'Failed to get job status');
    throw err;
  }
};

/**
 * Clean up old jobs
 */
const cleanupOldJobs = async () => {
  try {
    const count = await aiQueue.clean(24 * 60 * 60 * 1000, 10000); // 24 hours, max 10k jobs
    logger.info({ cleanedJobs: count }, 'Cleaned up old jobs');
  } catch (err) {
    logger.warn({ error: err }, 'Failed to cleanup old jobs');
  }
};

module.exports = {
  getQueue,
  enqueueAiChat,
  enqueueWeeklyReport,
  getJobStatus,
  cleanupOldJobs,
  isRedisAvailable,
  redisClient,
  queueConfig
};
