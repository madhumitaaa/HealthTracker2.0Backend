const mongoose = require('mongoose');

// 🔹 Task Schema
const TaskSchema = new mongoose.Schema({
  text: { type: String, required: true },
  done: { type: Boolean, default: false }
}, { _id: true });

// 🔹 Schedule Block Schema
const ScheduleSchema = new mongoose.Schema({
  time: { type: String, required: true },
  title: { type: String, required: true },

  // Optional: for normal activities
  tasks: [TaskSchema],

  // Optional: for workout blocks
  type: { type: String }, // "exercise"
  options: {
    home: [String],
    gym: [String]
  }
}, { _id: true });

// 🔹 Summary Schema
const SummarySchema = new mongoose.Schema({
  steps: Number,
  water: Number,
  sleep: Number,
  calories: Number
}, { _id: false });

// 🔹 Main Schema
const MorningPlanSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  date: {
    type: Date,
    required: true,
    index: true
  },

  routine: {
    schedule: {
      type: [ScheduleSchema],
      required: true
    },
    summary: SummarySchema
  }

}, {
  timestamps: true
});

// 🔥 Prevent duplicate plan per day
MorningPlanSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('MorningPlan', MorningPlanSchema);