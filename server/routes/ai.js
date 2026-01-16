const express = require('express');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middleware/authmiddleware');
const Entry = require('../models/Entry');

const router = express.Router();

// 🔒 Rate Limiter
const aiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 requests per user per window
  message: {
    message: 'Too many AI requests. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// ====================
// POST /ai/chat
// ====================
router.post('/chat', authMiddleware, aiRateLimiter, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ message: 'Message is required' });
    }

    const aiResponse = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: 'You are a friendly health assistant. No medical advice.'
          },
          { role: 'user', content: message }
        ],
        temperature: 0.7
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const reply = aiResponse.data.choices[0].message.content;
    res.json({ reply });
  } catch (error) {
    console.error('AI Chat Error:', error?.response?.data || error.message);
    res.status(500).json({
      message: 'AI chat failed',
      error: error?.response?.data || error.message
    });
  }
});

// ====================
// POST /ai/weekly-report
// ====================
router.post('/weekly-report', authMiddleware, aiRateLimiter, async (req, res) => {
  try {
    const userId = req.userId;

    // Last 7 days
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - 6);

    const entries = await Entry.find({
      user: userId,
      date: { $gte: startDate }
    }).sort({ date: 1 });

    if (!entries.length) {
      return res.status(404).json({
        message: 'No health data found for the past week'
      });
    }

    let totalCalories = 0;
    let totalSleep = 0;
    let workoutDays = 0;
    const foodSummary = [];

    entries.forEach(entry => {
      totalCalories += entry.calories || 0;
      totalSleep += entry.sleep || 0;
      if (entry.workouts) workoutDays++;
      if (Array.isArray(entry.foodIntake)) {
        entry.foodIntake.forEach(item => {
          foodSummary.push(
            `${item.meal}: ${item.food} (${item.calories} kcal)`
          );
        });
      }
    });

    const avgCalories = Math.round(totalCalories / entries.length);
    const avgSleep = (totalSleep / entries.length).toFixed(1);

    const prompt = `
Weekly health summary:

- Average daily calories: ${avgCalories}
- Average sleep: ${avgSleep} hours
- Workout days: ${workoutDays} / 7
- Food intake:
${foodSummary.join('\n')}

Write a concise, encouraging weekly health report.
Include:
1. Positive habits
2. Improvement areas
3. Practical lifestyle suggestions
Avoid medical advice.
`;

    const aiResponse = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: 'You are a friendly health assistant. No medical advice.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const report = aiResponse.data.choices[0].message.content;
    res.json({ report });
  } catch (error) {
    console.error('Weekly AI Report Error:', error?.response?.data || error.message);
    res.status(500).json({
      message: 'Weekly report generation failed',
      error: error?.response?.data || error.message
    });
  }
});

module.exports = router;
