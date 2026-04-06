const mongoose = require('mongoose');

const nightReviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // ✅ Store only UTC midnight to prevent duplicates
  date: {
    type: Date,
    required: true,
    default: () => {
      const now = new Date();
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    }
  },

  comparison: {
    steps: {
      planned: { type: Number, default: 0 },
      actual: { type: Number, default: 0 }
    },
    water: {
      planned: { type: Number, default: 0 },
      actual: { type: Number, default: 0 }
    },
    sleep: {
      planned: { type: Number, default: 7 },
      actual: { type: Number, default: 0 }
    },
    calories: {
      planned: { type: Number, default: 2000 },
      actual: { type: Number, default: 0 }
    }
  },

  completionRate: {
    type: Number,
    default: 0
  },

  score: {
    type: Number,
    default: 0
  },

  missed: [
    {
      type: String
    }
  ],

  aiReview: {
    type: String
  }

}, {
  timestamps: true
});

// ✅ Prevent duplicate reviews per user per day
nightReviewSchema.index({ user: 1, date: 1 }, { unique: true });

// ✅ Optional: ensure getters return consistent ISO date string
nightReviewSchema.set('toJSON', {
  getters: true,
  transform: (doc, ret) => {
    if (ret.date) ret.date = ret.date.toISOString().split('T')[0];
    return ret;
  }
});

nightReviewSchema.set('toObject', { getters: true });

module.exports = mongoose.model('NightReview', nightReviewSchema);