// utils/queue.js
const { Queue } = require('bullmq'); // removed QueueScheduler
const Redis = require('ioredis');
const logger = require('./logger');

const connection = new Redis({ host: '127.0.0.1', port: 6379 });

// Queues
const aiChatQueue = new Queue('aiChat', { connection });
const aiReportQueue = new Queue('weeklyReport', { connection });
const routineQueue = new Queue('aiRoutine', { connection });

// Redis check
const isRedisAvailable = async () => {
  try {
    return (await connection.ping()) === 'PONG';
  } catch (err) {
    logger.warn({ error: err.message }, 'Redis not available');
    return false;
  }
};

// Enqueue jobs
const enqueueAiChat = async (userId, message) => {
  const job = await aiChatQueue.add('chat', { userId, message });
  return job.id;
};
const enqueueWeeklyReport = async (userId) => {
  const job = await aiReportQueue.add('weeklyReport', { userId });
  return job.id;
};
const enqueueAiRoutine = async (userId, prompt) => {
  const job = await routineQueue.add('routine', { userId, prompt });
  return job.id;
};

// Job status
// Job status
const getJobStatus = async (jobId, queueName) => {
  // If no queueName provided, try all queues
  const queues = {
    aiChat: aiChatQueue,
    weeklyReport: aiReportQueue,
    aiRoutine: routineQueue
  };

  if (queueName) {
    const queue = queues[queueName];
    if (!queue) return { status: 'not-found' };
    const job = await queue.getJob(jobId);
    if (!job) return { status: 'not-found' };
    const state = await job.getState();
    return { status: state, data: job.data };
  } else {
    // Try to find job in any queue
    for (const qName of Object.keys(queues)) {
      const job = await queues[qName].getJob(jobId);
      if (job) {
        const state = await job.getState();
        return { status: state, data: job.data, queueName: qName };
      }
    }
    return { status: 'not-found' };
  }
};

module.exports = {
  enqueueAiChat,
  enqueueWeeklyReport,
  enqueueAiRoutine,
  getJobStatus,
  isRedisAvailable
};