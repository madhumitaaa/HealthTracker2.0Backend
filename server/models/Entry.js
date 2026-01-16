const mongoose = require('mongoose');

const foodSchema = new mongoose.Schema(
  {
    meal: { 
      type: String, 
      required: true, 
      trim: true,
      enum: ['breakfast', 'lunch', 'dinner', 'snack'],
      maxlength: 50
    },
    food: { 
      type: String, 
      required: true, 
      trim: true,
      maxlength: 200
    },
    calories: { 
      type: Number, 
      required: true,
      min: 0,
      max: 5000
    }
  },
  { _id: false }
);

const entrySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true,
    index: true // ✅ PRODUCTION: Index for date queries
  },
  calories: { 
    type: Number, 
    default: 0,
    min: 0,
    max: 10000
  },
  sleep: { 
    type: Number, 
    default: 0,
    min: 0,
    max: 24
  },
  workouts: { 
    type: Boolean, 
    default: false 
  },
  foodIntake: {
    type: [foodSchema],
    default: []
  },
  heartRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 220
  },
  steps: {
    type: Number,
    default: 0,
    min: 0
  },
  symptoms: {
    type: [String],
    default: [],
    maxlength: 10
  },
  mood: {
    type: String,
    enum: ['poor', 'fair', 'good', 'excellent'],
    default: 'neutral'
  },
  waterIntake: {
    type: Number,
    default: 0,
    min: 0
  }
}, { timestamps: true });

// ✅ PRODUCTION: Compound unique index on (user, date) - prevents duplicate daily entries
entrySchema.index({ user: 1, date: 1 }, { unique: true });

// ✅ PRODUCTION: Index on user for fast lookups
entrySchema.index({ user: 1, date: -1 });

/**
 * ✅ CRITICAL LINE — READ CAREFULLY
 * This prevents Mongoose from reusing an old cached model
 */
module.exports =
  mongoose.models.Entry || mongoose.model('Entry', entrySchema);
