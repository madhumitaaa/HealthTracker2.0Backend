/**
 * ✅ PRODUCTION-GRADE: Entries Routes with Validation & Error Handling
 * Includes input validation, async error handling, and proper indexing
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
   DASHBOARD SUMMARY — MUST BE ABOVE /:id ROUTES
========================================================= */
router.get(
  '/dashboard/summary',
  auth,
  asyncHandler(async (req, res) => {
    logger.info({ userId: req.userId }, 'Fetching dashboard summary');

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
   GET LAST 30 ENTRIES (with index optimization)
========================================================= */
router.get(
  '/',
  auth,
  asyncHandler(async (req, res) => {
    logger.info({ userId: req.userId }, 'Fetching last 30 entries');

    // ✅ PRODUCTION: Uses index on (user, date) for fast queries
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
   CREATE ENTRY (with unique constraint on user+date)
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

    const { date, calories, sleep, workouts, foodIntake } = req.body;

    // Normalize date to start of day
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);

    try {
      const entry = new Entry({
        user: req.userId,
        date: normalizedDate,
        calories,
        sleep,
        workouts,
        foodIntake
      });

      await entry.save();

      logger.info({ userId: req.userId, entryId: entry._id }, 'Entry created successfully');

      res.status(201).json({
        status: 'success',
        message: 'Entry created successfully',
        data: entry
      });
    } catch (err) {
      // ✅ PRODUCTION: Handle unique constraint violation
      if (err.code === 11000 && err.keyPattern?.date && err.keyPattern?.user) {
        logger.info({ userId: req.userId, date: normalizedDate }, 'Entry already exists for this date');
        return res.status(409).json({
          status: 'error',
          message: 'Entry already exists for this date'
        });
      }

      logger.error({ userId: req.userId, error: err.message }, 'Failed to create entry');
      throw err;
    }
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

    try {
      const entry = await Entry.findOneAndUpdate(
        { _id: id, user: req.userId },
        req.body,
        { new: true, runValidators: true }
      );

      if (!entry) {
        logger.warn({ userId: req.userId, entryId: id }, 'Entry not found');
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
    } catch (err) {
      logger.error({ userId: req.userId, entryId: id, error: err.message }, 'Failed to update entry');
      throw err;
    }
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
      logger.warn({ userId: req.userId, errors: errors.array() }, 'Delete validation failed');
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        details: errors.array()
      });
    }

    const { id } = req.params;

    try {
      const entry = await Entry.findOneAndDelete({
        _id: id,
        user: req.userId
      });

      if (!entry) {
        logger.warn({ userId: req.userId, entryId: id }, 'Entry not found');
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
    } catch (err) {
      logger.error({ userId: req.userId, entryId: id, error: err.message }, 'Failed to delete entry');
      throw err;
    }
  })
);

module.exports = router;
