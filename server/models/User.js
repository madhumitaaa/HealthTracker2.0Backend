const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  password: { 
    type: String, 
    required: true,
    minlength: 6
  },
  // ✅ PRODUCTION: Refresh tokens stored in DB for revocation
  refreshTokens: [{
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  // ✅ PRODUCTION: Token revocation list (for immediate logout)
  revokedTokens: [{
    token: { type: String, required: true },
    revokedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

// ✅ PRODUCTION: Index for faster refresh token lookups
userSchema.index({ 'refreshTokens.token': 1 });
userSchema.index({ email: 1 });

module.exports = mongoose.model('User', userSchema);
