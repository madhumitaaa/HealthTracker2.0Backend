/**
 * ✅ PRODUCTION-GRADE: Reusable Input Validation Rules
 * Centralized validation schemas for express-validator
 */

const { body, param } = require('express-validator');

// ===== AUTH VALIDATORS =====
const registerValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be 2-100 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6, max: 128 })
    .withMessage('Password must be 6-128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and number')
];

const loginValidator = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const refreshTokenValidator = [
  body('refreshToken')
    .trim()
    .notEmpty()
    .withMessage('Refresh token is required')
];

// ===== ENTRIES VALIDATORS =====
const createEntryValidator = [
  body('date')
    .isISO8601()
    .toDate()
    .withMessage('Valid date is required'),
  body('calories')
    .optional()
    .isInt({ min: 0, max: 10000 })
    .withMessage('Calories must be 0-10000'),
  body('sleep')
    .optional()
    .isFloat({ min: 0, max: 24 })
    .withMessage('Sleep must be 0-24 hours'),
  body('workouts')
    .optional()
    .isBoolean()
    .withMessage('Workouts must be boolean'),
  body('foodIntake')
    .optional()
    .isArray()
    .withMessage('foodIntake must be an array'),
  body('foodIntake.*.meal')
    .optional()
    .trim()
    .isIn(['breakfast', 'lunch', 'dinner', 'snack'])
    .withMessage('Meal must be breakfast, lunch, dinner, or snack'),
  body('foodIntake.*.food')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Food description max 200 characters'),
  body('foodIntake.*.calories')
    .optional()
    .isInt({ min: 0, max: 5000 })
    .withMessage('Food calories must be 0-5000')
];

const updateEntryValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid entry ID'),
  ...createEntryValidator
];

const deleteEntryValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid entry ID')
];

// ===== AI VALIDATORS =====
const aiChatValidator = [
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message must be 1-2000 characters')
    .escape() // Sanitize HTML/JS
];

const aiReportValidator = [
  // Weekly report doesn't need extra validation (uses auth)
];

module.exports = {
  // Auth
  registerValidator,
  loginValidator,
  refreshTokenValidator,

  // Entries
  createEntryValidator,
  updateEntryValidator,
  deleteEntryValidator,

  // AI
  aiChatValidator,
  aiReportValidator
};
