/**
 * ✅ PRODUCTION-GRADE: AI Routes with Async Job Queue
 * Supports both async (BullMQ) and synchronous (fallback) modes
 * Implements input validation, sanitization, and rate limiting
 */

const express = require('express');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const { validationResult } = require('express-validator');
const authMiddleware = require('../middleware/authmiddleware');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const { sanitizeMessage } = require('../utils/sanitizer');
const Entry = require('../models/Entry');
const { aiChatValidator, aiReportValidator } = require('../utils/validators');

const router = express.Router();

// ✅ PRODUCTION: Rate limiter for AI endpoints
const aiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 requests per user per window
  message: 'Too many AI requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req, res) => {
    // Don't rate limit GET requests (job status checks)
    return req.method === 'GET';
  }
});

// ✅ Queue setup (loaded conditionally if Redis available)
let queueAvailable = false;
let enqueueAiChat, enqueueWeeklyReport, getJobStatus;

const initializeQueue = async () => {
  try {
    const queueModule = require('../utils/queue');
    const redisAvailable = await queueModule.isRedisAvailable();
    if (redisAvailable) {
      enqueueAiChat = queueModule.enqueueAiChat;
      enqueueWeeklyReport = queueModule.enqueueWeeklyReport;
      getJobStatus = queueModule.getJobStatus;
      queueAvailable = true;
      logger.info('Queue initialized successfully');
    } else {
      logger.warn('Redis not available - AI endpoints will use synchronous mode');
      queueAvailable = false;
    }
  } catch (err) {
    logger.warn({ error: err.message }, 'Failed to initialize queue - using sync mode');
    queueAvailable = false;
  }
};

// Initialize on startup
initializeQueue();

/**
 * Call Groq AI API (synchronous fallback)
 */
const callGroqAPISync = async (messages, temperature = 0.7) => {
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
    logger.error({ error: err.message }, 'Groq API call failed');
    throw new Error(`AI API failed: ${err.message}`);
  }
};

// ====================
// POST /ai/chat
// ====================
router.post(
  '/chat',
  authMiddleware,
  aiRateLimiter,
  aiChatValidator,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn({ userId: req.userId, errors: errors.array() }, 'Chat validation failed');
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        details: errors.array()
      });
    }

    const { message } = req.body;
    const sanitizedMessage = sanitizeMessage(message);

    try {
      // ✅ PRODUCTION: Try async queue first
      if (queueAvailable && process.env.ENABLE_ASYNC_JOBS === 'true') {
        try {
          const jobId = await enqueueAiChat(req.userId, sanitizedMessage);

          logger.info({ jobId, userId: req.userId }, 'Chat job enqueued');

          return res.json({
            status: 'success',
            message: 'Chat request queued for processing',
            jobId,
            mode: 'async',
            checkStatusUrl: `/ai/job-status/${jobId}`
          });
        } catch (queueErr) {
          logger.warn({ error: queueErr.message }, 'Queue unavailable, falling back to sync');
          // Fall through to sync mode
        }
      }

      // ✅ FALLBACK: Synchronous mode (maintains frontend compatibility)
      logger.info({ userId: req.userId }, 'Processing chat synchronously');

      const reply = await callGroqAPISync([
        {
          role: 'system',
          content: 'You are a friendly health assistant. No medical advice.'
        },
        { role: 'user', content: sanitizedMessage }
      ]);

      logger.info({ userId: req.userId }, 'Chat completed successfully');

      res.json({
        status: 'success',
        reply,
        mode: 'sync' // Indicates synchronous response
      });
    } catch (error) {
      logger.error({ userId: req.userId, error: error.message }, 'Chat error');
      res.status(500).json({
        status: 'error',
        message: 'AI chat failed',
        details: error.message
      });
    }
  })
);

// ====================
// POST /ai/weekly-report
// ====================
router.post(
  '/weekly-report',
  authMiddleware,
  aiRateLimiter,
  aiReportValidator,
  asyncHandler(async (req, res) => {
    const userId = req.userId;

    try {
      // ✅ PRODUCTION: Try async queue first
      if (queueAvailable && process.env.ENABLE_ASYNC_JOBS === 'true') {
        try {
          const jobId = await enqueueWeeklyReport(userId);

          logger.info({ jobId, userId }, 'Weekly report job enqueued');

          return res.json({
            status: 'success',
            message: 'Weekly report generation queued',
            jobId,
            mode: 'async',
            checkStatusUrl: `/ai/job-status/${jobId}`
          });
        } catch (queueErr) {
          logger.warn({ error: queueErr.message }, 'Queue unavailable, falling back to sync');
          // Fall through to sync mode
        }
      }

      // ✅ FALLBACK: Synchronous mode
      logger.info({ userId }, 'Processing weekly report synchronously');

      // Last 7 days
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      startDate.setDate(startDate.getDate() - 6);

      const entries = await Entry.find({
        user: userId,
        date: { $gte: startDate }
      }).sort({ date: 1 });

      if (!entries.length) {
        logger.info({ userId }, 'No entries found for weekly report');
        return res.status(404).json({
          status: 'error',
          message: 'No health data found for the past week'
        });
      }

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

      const report = await callGroqAPISync([
        {
          role: 'system',
          content: 'You are a friendly health assistant. No medical advice.'
        },
        { role: 'user', content: prompt }
      ]);

      logger.info({ userId }, 'Weekly report completed successfully');

      res.json({
        status: 'success',
        report,
        mode: 'sync'
      });
    } catch (error) {
      logger.error({ userId, error: error.message }, 'Weekly report error');
      res.status(500).json({
        status: 'error',
        message: 'Weekly report generation failed',
        details: error.message
      });
    }
  })
);

// ====================
// GET /ai/job-status/:jobId
// ====================
router.get(
  '/job-status/:jobId',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { jobId } = req.params;

    if (!queueAvailable) {
      return res.status(503).json({
        status: 'error',
        message: 'Queue not available'
      });
    }

    try {
      const status = await getJobStatus(jobId);

      if (status.status === 'not-found') {
        return res.status(404).json({
          status: 'error',
          message: 'Job not found'
        });
      }

      res.json({
        status: 'success',
        job: status
      });
    } catch (error) {
      logger.error({ jobId, error: error.message }, 'Job status check failed');
      res.status(500).json({
        status: 'error',
        message: 'Failed to get job status',
        details: error.message
      });
    }
  })
);

module.exports = router;
