/**
 * ✅ PRODUCTION-GRADE: Entries Routes with Validation & Error Handling
 * Includes input validation, async error handling, proper indexing,
 * and fixes duplicate/zero-value entry issues
 */

const express = require('express');
const { validationResult } = require('express-validator');
const Entry = require('../models/Entry');
const auth = require('../middleware/authmiddleware');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const {
  createEntryValidator,
  updateEntryValidator,
  deleteEntryValidator
} = require('../utils/validators');

const router = express.Router();

/* =========================================================
   DASHBOARD SUMMARY
========================================================= */
router.get(
  '/dashboard/summary',
  auth,
  asyncHandler(async (req, res) => {
    logger.info({ userId: req.userId }, 'Fetching dashboard summary');

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const entry = await Entry.findOne({
      user: req.userId,
      date: { $gte: startOfDay, $lte: endOfDay },
    });

    res.json({
      status: 'success',
      data: {
        calories: entry?.calories || 0,
        sleep: entry?.sleep || 0,
        workouts: entry?.workouts ? 1 : 0,
        heartRate: entry?.heartRate || 0,
        steps: entry?.steps || 0,
        symptoms: entry?.symptoms || [],
        mood: entry?.mood || 'neutral',
        waterIntake: entry?.waterIntake || 0,
        foodIntake: entry?.foodIntake || []
      }
    });
  })
);

/* =========================================================
   GET LAST 30 ENTRIES
========================================================= */
router.get(
  '/',
  auth,
  asyncHandler(async (req, res) => {
    logger.info({ userId: req.userId }, 'Fetching last 30 entries');

    const entries = await Entry.find({ user: req.userId })
      .sort({ date: -1 })
      .limit(30);

    res.json({
      status: 'success',
      count: entries.length,
      data: entries
    });
  })
);

/* =========================================================
   CREATE ENTRY
========================================================= */
router.post(
  '/',
  auth,
  createEntryValidator,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn({ userId: req.userId, errors: errors.array() }, 'Entry validation failed');
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        details: errors.array()
      });
    }

    // Destructure with defaults to avoid zero-value issues
    const {
      date,
      calories = 0,
      sleep = 0,
      workouts = false,
      foodIntake = [],
      heartRate = 0,
      steps = 0,
      symptoms = [],
      mood = 'neutral',
      waterIntake = 0
    } = req.body;

    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);

    // ✅ Check for existing entry on the same day
    const start = new Date(normalizedDate);
    const end = new Date(normalizedDate);
    end.setHours(23, 59, 59, 999);

    const existingEntry = await Entry.findOne({
      user: req.userId,
      date: { $gte: start, $lte: end }
    });

    if (existingEntry) {
      return res.status(409).json({
        status: 'error',
        message: 'Entry already exists for this date'
      });
    }

    const entry = new Entry({
      user: req.userId,
      date: normalizedDate,
      calories,
      sleep,
      workouts,
      foodIntake,
      heartRate,
      steps,
      symptoms,
      mood,
      waterIntake
    });

    await entry.save();

    logger.info({ userId: req.userId, entryId: entry._id }, 'Entry created successfully');

    res.status(201).json({
      status: 'success',
      message: 'Entry created successfully',
      data: entry
    });
  })
);

/* =========================================================
   UPDATE ENTRY BY ID
========================================================= */
router.put(
  '/:id',
  auth,
  updateEntryValidator,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn({ userId: req.userId, errors: errors.array() }, 'Update validation failed');
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        details: errors.array()
      });
    }

    const { id } = req.params;

    const entry = await Entry.findOneAndUpdate(
      { _id: id, user: req.userId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!entry) {
      return res.status(404).json({
        status: 'error',
        message: 'Entry not found'
      });
    }

    logger.info({ userId: req.userId, entryId: id }, 'Entry updated successfully');

    res.json({
      status: 'success',
      message: 'Entry updated successfully',
      data: entry
    });
  })
);

/* =========================================================
   DELETE ENTRY
========================================================= */
router.delete(
  '/:id',
  auth,
  deleteEntryValidator,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        details: errors.array()
      });
    }

    const { id } = req.params;

    const entry = await Entry.findOneAndDelete({
      _id: id,
      user: req.userId
    });

    if (!entry) {
      return res.status(404).json({
        status: 'error',
        message: 'Entry not found'
      });
    }

    logger.info({ userId: req.userId, entryId: id }, 'Entry deleted successfully');

    res.json({
      status: 'success',
      message: 'Entry deleted successfully'
    });
  })
);

module.exports = router;