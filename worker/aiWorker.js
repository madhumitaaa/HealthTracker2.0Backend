/**
 * ✅ PRODUCTION-GRADE: AI Worker Process
 * Processes async AI jobs from the queue
 * Handles retries, logging, and error recovery
 * 
 * Run this in a separate process: node start-worker.js
 */

require('dotenv').config();
const { Worker } = require('bullmq');
const axios = require('axios');
const mongoose = require('mongoose');
const logger = require('./utils/logger');
const Entry = require('./models/Entry');

// Initialize MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => logger.info('Worker: MongoDB connected'))
  .catch((err) => {
    logger.error({ error: err }, 'Worker: MongoDB connection failed');
    process.exit(1);
  });

/**
 * Call Groq AI API for chat
 */
const callGroqAPI = async (messages, temperature = 0.7) => {
  const maxRetries = 3;
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'llama-3.1-8b-instant',
          messages,
          temperature,
          max_tokens: 1000
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      return response.data.choices[0].message.content;
    } catch (err) {
      lastError = err;
      logger.warn(
        { attempt: i + 1, error: err.message },
        'Groq API call failed, retrying...'
      );

      if (i < maxRetries - 1) {
        // Wait before retry (exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, i)));
      }
    }
  }

  throw new Error(`Groq API failed after ${maxRetries} attempts: ${lastError.message}`);
};

/**
 * Process chat job
 */
const processChatJob = async (job) => {
  const { userId, message } = job.data;
  logger.info({ jobId: job.id, userId }, 'Processing chat job');

  try {
    job.updateProgress(25);

    const reply = await callGroqAPI([
      {
        role: 'system',
        content: 'You are a friendly health assistant. Provide helpful health tips without medical advice.'
      },
      { role: 'user', content: message }
    ]);

    job.updateProgress(100);

    logger.info({ jobId: job.id, userId }, 'Chat job completed successfully');

    return {
      success: true,
      reply,
      processedAt: new Date()
    };
  } catch (err) {
    logger.error({ jobId: job.id, userId, error: err.message }, 'Chat job failed');
    throw err;
  }
};

/**
 * Process weekly report job
 */
const processWeeklyReportJob = async (job) => {
  const { userId } = job.data;
  logger.info({ jobId: job.id, userId }, 'Processing weekly report job');

  try {
    job.updateProgress(10);

    // Fetch last 7 days of entries
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - 6);

    const entries = await Entry.find({
      user: userId,
      date: { $gte: startDate }
    }).sort({ date: 1 });

    job.updateProgress(30);

    if (!entries.length) {
      logger.info({ jobId: job.id, userId }, 'No entries found for weekly report');
      return {
        success: false,
        error: 'No health data found for the past week'
      };
    }

    // Aggregate data
    let totalCalories = 0;
    let totalSleep = 0;
    let workoutDays = 0;
    const foodSummary = [];

    entries.forEach((entry) => {
      totalCalories += entry.calories || 0;
      totalSleep += entry.sleep || 0;
      if (entry.workouts) workoutDays++;
      if (Array.isArray(entry.foodIntake)) {
        entry.foodIntake.forEach((item) => {
          foodSummary.push(
            `${item.meal}: ${item.food} (${item.calories} kcal)`
          );
        });
      }
    });

    const avgCalories = Math.round(totalCalories / entries.length);
    const avgSleep = (totalSleep / entries.length).toFixed(1);

    job.updateProgress(60);

    const prompt = `
Weekly health summary (${entries.length} days of data):

- Average daily calories: ${avgCalories} kcal
- Average sleep: ${avgSleep} hours
- Workout days: ${workoutDays} / 7
- Food intake:
${foodSummary.slice(0, 20).join('\n')}

Write a concise, encouraging weekly health report (150-200 words).
Include:
1. Positive habits observed
2. Areas for improvement
3. One practical lifestyle suggestion
Avoid medical advice.
`;

    const report = await callGroqAPI([
      {
        role: 'system',
        content: 'You are a friendly health assistant providing motivational weekly summaries.'
      },
      { role: 'user', content: prompt }
    ]);

    job.updateProgress(100);

    logger.info({ jobId: job.id, userId }, 'Weekly report job completed successfully');

    return {
      success: true,
      report,
      summary: {
        avgCalories,
        avgSleep,
        workoutDays,
        totalDays: entries.length
      },
      processedAt: new Date()
    };
  } catch (err) {
    logger.error({ jobId: job.id, userId, error: err.message }, 'Weekly report job failed');
    throw err;
  }
};

/**
 * Create and start worker
 */
const startWorker = async () => {
  const worker = new Worker(
    'ai-tasks',
    async (job) => {
      logger.info({ jobId: job.id, type: job.name }, 'Processing job');

      try {
        if (job.name === 'chat') {
          return await processChatJob(job);
        } else if (job.name === 'weekly-report') {
          return await processWeeklyReportJob(job);
        } else {
          throw new Error(`Unknown job type: ${job.name}`);
        }
      } catch (err) {
        logger.error(
          { jobId: job.id, type: job.name, error: err.message },
          'Job processing failed'
        );
        throw err;
      }
    },
    {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: process.env.REDIS_DB || 0
      },
      concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5'), // Max 5 concurrent jobs
      maxStalledCount: 2,
      stalledInterval: 30000,
      lockDuration: 30000
    }
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Job completed successfully');
  });

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job.id, attempts: job.attemptsMade, error: err.message },
      'Job failed permanently'
    );
  });

  worker.on('error', (err) => {
    logger.error({ error: err }, 'Worker error');
  });

  worker.on('stalled', (jobId) => {
    logger.warn({ jobId }, 'Job stalled, will retry');
  });

  logger.info('AI Worker started successfully');
  logger.info(
    {
      concurrency: process.env.WORKER_CONCURRENCY || 5,
      redis: `${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`
    },
    'Worker configuration'
  );

  return worker;
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down worker gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down worker gracefully...');
  process.exit(0);
});

// Start worker
startWorker().catch((err) => {
  logger.error({ error: err }, 'Failed to start worker');
  process.exit(1);
});
