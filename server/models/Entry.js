const mongoose = require('mongoose');

const foodSchema = new mongoose.Schema(
  {
    meal: { type: String, required: true, trim: true },
    food: { type: String, required: true, trim: true },
    calories: { type: Number, required: true }
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
    required: true
  },
  calories: { type: Number, default: 0 },
  sleep: { type: Number, default: 0 },
  workouts: { type: Boolean, default: false },
  foodIntake: {
    type: [foodSchema],
    default: []
  }
});

/**
 * ✅ CRITICAL LINE — READ CAREFULLY
 * This prevents Mongoose from reusing an old cached model
 */
module.exports =
  mongoose.models.Entry || mongoose.model('Entry', entrySchema);
