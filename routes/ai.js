/**
 * ✅ PRODUCTION-GRADE: AI Routes with Async Job Queue
 * Supports both async (BullMQ) and synchronous (fallback) modes
 * Implements input validation, sanitization, and rate limiting
 */

const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const { validationResult } = require('express-validator');
const authMiddleware = require('../middleware/authmiddleware');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const { sanitizeMessage } = require('../utils/sanitizer');
const Entry = require('../models/Entry');
const { aiChatValidator, aiReportValidator } = require('../utils/validators');
const User = require('../models/User'); 
const router = express.Router();
const MorningPlan = require('../models/MorningPlan');
const NightReview = require('../models/NightReview');
// ✅ PRODUCTION: Rate limiter for AI endpoints
// Rate limiter
const aiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  message: 'Too many requests. Try later.',
  standardHeaders: true,
  legacyHeaders: false
});

// ✅ Queue setup (loaded conditionally if Redis available)
// ✅ Queue setup (loaded conditionally if Redis available)
let queueAvailable = false;
let enqueueAiChat, enqueueWeeklyReport, enqueueAiRoutine, getJobStatus;

const initializeQueue = async () => {
  try {
    const queueModule = require('../utils/queue');

    console.log('🔹 Checking Redis connection...');
    const redisAvailable = await queueModule.isRedisAvailable();

    if (redisAvailable) {
      enqueueAiChat = queueModule.enqueueAiChat;
      enqueueWeeklyReport = queueModule.enqueueWeeklyReport;
      enqueueAiRoutine = queueModule.enqueueAiRoutine;
      getJobStatus = queueModule.getJobStatus;

      queueAvailable = true;
      console.log('✅ Queue initialized successfully. Redis is available.');
    } else {
      queueAvailable = false;
      console.warn('❌ Redis not available - AI endpoints will use synchronous mode');
    }
  } catch (err) {
    queueAvailable = false;
    console.error('❌ Failed to initialize queue:', err.stack || err.message);
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
  message: reply,
  mode: 'sync'
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
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

      const entries = await Entry.find({
        user: userId,
        date: { $gte: new Date(Date.now() - 6 * 24*60*60*1000) }
      }).sort({ date: 1 });

      if (!entries.length)
        return res.status(200).json({ status: 'success', report: 'No entries for this week', mode: 'sync' });

      const avgCalories = Math.round(entries.reduce((a, e) => a + (e.calories || 0), 0) / entries.length);
      const avgSleep = (entries.reduce((a, e) => a + (e.sleep || 0), 0) / entries.length).toFixed(1);

     const prompt = `
You are a professional health advisor. Write a **detailed weekly health report** for the user in a **clear, structured, and professional format**, similar to a doctor’s weekly checkup.

The user's data for the week (${entries.length} days):
- Average Calories: ${avgCalories} kcal
- Average Sleep: ${avgSleep} hrs
- Include other metrics like Steps, Water Intake, Mood, Workouts, Heart Rate if available

STRICT STRUCTURE (use headings, line breaks, and bullet points):

1. **Summary of the Week**  
   - Highlight key achievements and metrics where the user met or exceeded goals  
   - Use concise bullet points  
   - Include any notable patterns

2. **Areas for Improvement**  
   - List metrics below recommended targets  
   - Explain the gaps clearly with numbers and units  
   - Keep each point short and actionable

3. **Root Cause Analysis**  
   - Explain why certain targets were missed  
   - Use clear reasoning (e.g., irregular sleep schedule, skipped meals, low hydration, lack of exercise)  
   - Each root cause should be a separate bullet point

4. **Next Week Strategy**  
   - Prioritized goals for next week  
   - Exact numeric targets for each metric (Calories, Sleep, Steps, Water, etc.)  
   - Specific actionable steps for improvement  
   - Tips for maintaining consistency and avoiding previous pitfalls

5. **Motivational Note**  
   - Short, encouraging, professional message  
   - Focus on actionable steps and progress, not generic advice  

FORMAT REQUIREMENTS:  
- Use headings exactly as above  
- Use bullet points for every item under each heading  
- Add line breaks between sections and points for readability  
- Use numbers and units where possible  
- Avoid generic or vague advice  
- Output must be ready to display as multi-line text in a UI component

Example output:

---
**Summary of the Week**  
- Avg Calories: 2100 kcal (goal met 5/7 days)  
- Avg Sleep: 7.2 hrs (goal met 6/7 days)  
- Step goal exceeded on 4 days  
- Water intake: average 6 cups/day  

**Areas for Improvement**  
- Sleep: 6 hrs on 2 days (below 7 hrs target)  
- Water: 5 cups/day average (below 7 cups target)  
- Step goal not reached on 3 days  

**Root Cause Analysis**  
- Late work hours reduced sleep  
- Skipped water intake during busy mornings  
- Inconsistent exercise routine  

**Next Week Strategy**  
- Prioritize: Sleep 7+ hrs daily, drink 7+ cups water daily  
- Reduce: Late-night screen time  
- Exact targets: Calories 2000-2200 kcal/day, Steps 7000/day, Sleep 7+ hrs, Water 7+ cups/day  
- Tips: Set reminders for hydration, schedule morning walks, maintain sleep schedule  

**Motivational Note**  
Excellent progress this week! Keep following your plan consistently and aim to hit all targets next week. Small consistent improvements lead to long-term success.
---
`;

      const report = await callGroqAPISync([
        { role: 'system', content: 'Friendly health assistant.' },
        { role: 'user', content: prompt }
      ]);

      res.json({ status: 'success', report, mode: 'sync' });
    } catch (error) {
      logger.error({ userId: req.userId, error: error.message }, 'Weekly report failed');
      res.status(500).json({ status: 'error', message: 'Weekly report failed', details: error.message });
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
      // Pass jobId only, queueName optional
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
// POST /ai/daily-routine
// ====================
// POST /ai/daily-routine (FIXED VERSION)
// ====================
router.post(
  '/daily-routine',
  authMiddleware,
  aiRateLimiter,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.userId);
    const profile = user?.profile;

    if (!user || !profile) {
      return res.status(404).json({
        status: 'error',
        message: 'User or profile not found'
      });
    }

    const {
      height = 160,
      weight = 55,
      age = 25,
      gender = 'female',
      goal = 'maintain',
      bmi
    } = profile;

    const prompt = `
Generate a FULL DAY structured routine.

User Profile:
- Age: ${age}
- Gender: ${gender}
- Height: ${height} cm
- Weight: ${weight} kg
- BMI: ${bmi ? bmi.toFixed(2) : 'N/A'}
- Goal: ${goal}

STRICT:
- ONLY JSON
- No explanation

FORMAT:
{
  "schedule": [
    {
      "time": "6:30 AM",
      "title": "Morning Start",
      "tasks": [
        { "text": "Drink water", "done": false }
      ]
    }
  ],
  "summary": {
    "steps": 10000,
    "water": 2.5,
    "sleep": 7,
    "calories": 2000
  }
}
`;

    try {
      // ✅ ASYNC MODE
      if (queueAvailable && process.env.ENABLE_ASYNC_JOBS === 'true') {
        try {
          const jobId = await enqueueAiRoutine(user._id, prompt);

          return res.json({
            status: 'success',
            jobId,
            mode: 'async',
            checkStatusUrl: `/ai/job-status/${jobId}`
          });
        } catch (queueErr) {
          logger.error({ error: queueErr.message }, 'Queue failed → fallback sync');
        }
      }

      // ✅ SYNC MODE
      const routineRaw = await callGroqAPISync([
        { role: 'system', content: 'You are a structured health planner. No medical advice.' },
        { role: 'user', content: prompt }
      ]);

      let routine = null;

      // ✅ SAFE JSON PARSE
      try {
        const first = routineRaw.indexOf('{');
        const last = routineRaw.lastIndexOf('}');
        if (first >= 0 && last > first) {
          routine = JSON.parse(routineRaw.slice(first, last + 1));
        }
      } catch (err) {
        logger.warn({ error: err.message, raw: routineRaw }, 'Invalid AI JSON');
      }

      // ❗ HARD VALIDATION (FULL STRUCTURE)
      if (
        !routine ||
        !Array.isArray(routine.schedule) ||
        !routine.summary ||
        typeof routine.summary !== 'object'
      ) {
        logger.warn('Invalid AI routine → fallback');

        routine = {
          schedule: [
            {
              time: "7:00 AM",
              title: "Morning Start",
              tasks: [
                { text: "Drink 1 glass water", done: false },
                { text: "Stretch 5 mins", done: false }
              ]
            }
          ],
          summary: {
            steps: 8000,
            water: 2,
            sleep: 7,
            calories: 2000
          }
        };
      }

      // ✅ CONSISTENT UTC DATE (IMPORTANT FIX)
      const today = new Date();
      const startOfDay = new Date(Date.UTC(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        0, 0, 0, 0
      ));

      const existingPlan = await MorningPlan.findOne({
        user: user._id,
        date: startOfDay
      });

      if (!existingPlan) {
        await MorningPlan.create({
          user: user._id,
          date: startOfDay,
          routine
        });
      }

      res.json({
        status: 'success',
        routine,
        mode: 'sync'
      });

    } catch (error) {
      logger.error({ userId: user._id, error: error.message }, 'Routine failed');

      res.status(500).json({
        status: 'error',
        message: 'Routine generation failed',
        details: error.message
      });
    }
  })
);

router.get(
  '/night-review',
  authMiddleware,
  aiRateLimiter,
  asyncHandler(async (req, res) => {
    // ✅ UTC-safe start/end of day
    const now = new Date();
    const startOfDayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const endOfDayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

    // ✅ Fetch today's morning plan
    const plan = await MorningPlan.findOne({
      user: req.userId,
      date: { $gte: startOfDayUTC, $lte: endOfDayUTC }
    });

    if (!plan) {
      return res.status(404).json({ status: 'error', message: 'Morning plan not found' });
    }

    // ✅ Fetch today's entry
    const entry = await Entry.findOne({
      user: req.userId,
      date: { $gte: startOfDayUTC, $lte: endOfDayUTC }
    });

    if (!entry) {
      return res.status(404).json({ status: 'error', message: 'No entry found for today' });
    }

    // ✅ Safe routine fallback
    const safeRoutine =
      plan.routine && typeof plan.routine === 'object' && !plan.routine.raw
        ? plan.routine
        : { steps: 0, water: 0, sleep: 7, calories: 2000, meals: {}, workouts: {}, mindfulness: '', tips: '' };

    const routineSummary = plan.routine?.summary || {};

    // ✅ Compare planned vs actual
    const comparison = {
      steps: { planned: Number(routineSummary.steps) || 0, actual: Number(entry.steps) || 0 },
      water: { planned: Number(routineSummary.water) || 0, actual: Number(entry.water) || 0 },
      sleep: { planned: Number(routineSummary.sleep) || 7, actual: Number(entry.sleep) || 0 },
      calories: { planned: Number(routineSummary.calories) || 2000, actual: Number(entry.calories) || 0 }
    };

    // ✅ Completion logic
    const metrics = Object.values(comparison);
    const missedMetrics = Object.entries(comparison)
      .filter(([_, value]) => value.planned > 0 && value.actual < value.planned)
      .map(([key]) => key);

    const completed = metrics.filter(m => m.actual >= m.planned).length;
    const totalGoals = metrics.length;
    const completionRate = totalGoals ? Math.round((completed / totalGoals) * 100) : 0;
    const score = Math.min(completionRate + (completed >= 3 ? 10 : 0), 100);

    // ✅ AI Prompt
const prompt = `
You are an elite performance coach. Provide the NIGHT REVIEW in **strict markdown** with numbered sections and bullet points.

User stats:

- Steps: ${comparison.steps.actual}/${comparison.steps.planned}
- Water: ${comparison.water.actual}/${comparison.water.planned}
- Sleep: ${comparison.sleep.actual}/${comparison.sleep.planned}
- Calories: ${comparison.calories.actual}/${comparison.calories.planned}

Completion Rate: ${completionRate}%

STRICT FORMAT:

1. **Wins**: list all achieved goals with numbers
2. **Failures**: list all gaps with numbers
3. **Root Cause**: explain why user failed
4. **Next Day Strategy**:
   - **PRIORITIZE**: things to do first
   - **REDUCE**: things to reduce
   - **Exact targets**: provide numbers
5. **Motivation**: short, strong encouragement

Output must use **line breaks, markdown lists, and numbered sections exactly as above**.
Do not add anything else. No fluff, no generic advice.
`;

    // ✅ Check existing review
    let existingReview = await NightReview.findOne({
      user: req.userId,
      date: startOfDayUTC
    });

    let aiResponse;
    if (existingReview?.aiReview) {
      aiResponse = existingReview.aiReview;
    } else {
      aiResponse = await callGroqAPISync([
        { role: 'system', content: 'You are a motivating health assistant. No medical advice.' },
        { role: 'user', content: prompt }
      ]);
    }

    // ✅ Upsert NightReview safely
    existingReview = await NightReview.findOneAndUpdate(
      { user: req.userId, date: startOfDayUTC }, // exact date match
      {
        comparison,
        completionRate,
        score,
        missed: missedMetrics,
        aiReview: aiResponse,
        date: startOfDayUTC
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // ✅ Chart data
    const chartData = {
      pie: [
        { name: 'Completed', value: completed },
        { name: 'Missed', value: totalGoals - completed }
      ],
      bar: [
        { metric: 'Steps', planned: comparison.steps.planned, actual: comparison.steps.actual },
        { metric: 'Water', planned: comparison.water.planned, actual: comparison.water.actual },
        { metric: 'Sleep', planned: comparison.sleep.planned, actual: comparison.sleep.actual },
        { metric: 'Calories', planned: comparison.calories.planned, actual: comparison.calories.actual }
      ]
    };

    // ✅ Calculate streak (latest 7 reviews)
    const lastReviews = await NightReview.find({ user: req.userId })
      .sort({ date: -1 })
      .limit(7);

    let streak = 0;
    let prevDate = null;
    const normalize = d => { const date = new Date(d); date.setHours(0, 0, 0, 0); return date; };

    for (const review of lastReviews) {
      const currentDate = new Date(review.date);
      if (prevDate) {
        const diffDays = Math.round((normalize(prevDate) - normalize(currentDate)) / (1000 * 60 * 60 * 24));
        if (diffDays > 1) break;
      }
      if (review.completionRate >= 70) {
        streak++;
        prevDate = currentDate;
      } else break;
    }

    // ✅ Response
    res.json({
      status: 'success',
      date: startOfDayUTC,
      summary: comparison,
      completionRate,
      score,
      completed,
      totalGoals,
      streak,
      missed: missedMetrics,
      charts: chartData,
      aiReview: aiResponse
    });
  })
);


router.get(
  '/weekly-progress',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const NightReview = require('../models/NightReview');

    const last7Days = await NightReview.find({
  user: req.userId
})
  .sort({ date: -1 }) // ✅ get latest first
  .limit(7);

const graphData = last7Days
  .reverse() // ✅ oldest → newest (for chart)
  .map((r) => ({
    date: r.date.toISOString().split('T')[0],
    completionRate: r.completionRate,
    score: r.score
  }));

    res.json({
      status: 'success',
      weekly: graphData
    });
  })
);


module.exports = router;
