const express = require('express');
const { body, validationResult } = require('express-validator');
const Entry = require('../models/Entry');
const auth = require('../middleware/authmiddleware');

const router = express.Router();

/* =========================================================
   DASHBOARD SUMMARY — MUST BE ABOVE /:id ROUTES
========================================================= */
router.get('/dashboard/summary', auth, async (req, res) => {
  try {
    const now = new Date();

    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0, 0, 0, 0
    );

    const endOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23, 59, 59, 999
    );

    const entry = await Entry.findOne({
      user: req.userId,
      date: { $gte: startOfDay, $lte: endOfDay },
    });

    res.json({
      calories: entry?.calories || 0,
      sleep: entry?.sleep || 0,
      workouts: entry?.workouts ? 1 : 0,
      heartRate: entry?.heartRate || 0,
      steps: entry?.steps || 0,
      symptoms: entry?.symptoms || [],
      mood: entry?.mood || 'neutral',
      waterIntake: entry?.waterIntake || 0,
      foodIntake: entry?.foodIntake || [],
    });
  } catch (err) {
    console.error('Dashboard Summary Error:', err);
    res.status(500).json({
      message: 'Internal server error',
      error: err.message,
    });
  }
});

/* =========================================================
   GET LAST 30 ENTRIES
========================================================= */
router.get('/', auth, async (req, res) => {
  try {
    const entries = await Entry.find({ user: req.userId })
      .sort({ date: -1 })
      .limit(30);

    res.json(entries);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* =========================================================
   CREATE / UPDATE ENTRY (ONE PER DAY)
========================================================= */
router.post('/', auth, async (req, res) => {
  console.log(Entry.schema.paths.foodIntake.schema.paths);

  try {
    const {
      date,
      calories,
      sleep,
      workouts,
      foodIntake
    } = req.body;

    // normalize date to start of day
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);

    const entry = new Entry({
      user: req.userId,   // ✅ IMPORTANT
      date: normalizedDate,
      calories,
      sleep,
      workouts,
      foodIntake
    });

    await entry.save();

    res.status(201).json(entry);
  } catch (error) {
    console.error('Entry Save Error:', error);
    res.status(500).json({
      message: 'Failed to save entry',
      error: error.message
    });
  }
});

/* =========================================================
   UPDATE ENTRY BY ID
========================================================= */
router.put('/:id', auth, async (req, res) => {
  try {
    const entry = await Entry.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      req.body,
      { new: true }
    );

    if (!entry)
      return res.status(404).json({ message: 'Entry not found' });

    res.json(entry);
  } catch (err) {
    res.status(500).json({
      message: 'Failed to update entry',
      error: err.message,
    });
  }
});

/* =========================================================
   DELETE ENTRY
========================================================= */
router.delete('/:id', auth, async (req, res) => {
  try {
    const entry = await Entry.findOneAndDelete({
      _id: req.params.id,
      user: req.userId,
    });

    if (!entry)
      return res.status(404).json({ message: 'Entry not found' });

    res.json({ message: 'Entry deleted successfully' });
  } catch (err) {
    res.status(500).json({
      message: 'Failed to delete entry',
      error: err.message,
    });
  }
});

module.exports = router;
