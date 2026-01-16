/**
 * ✅ PRODUCTION-GRADE: Auth Routes with JWT Refresh Tokens
 * Implements short-lived accessToken (15min) + long-lived refreshToken (7d)
 * Maintains backward compatibility with existing frontend
 */

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const auth = require('../middleware/authmiddleware');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const {
  registerValidator,
  loginValidator,
  refreshTokenValidator
} = require('../utils/validators');

const router = express.Router();

// Token configuration
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

/**
 * Generate accessToken and refreshToken
 */
const generateTokens = (userId) => {
  // ✅ Short-lived accessToken
  const accessToken = jwt.sign(
    { userId, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  // ✅ Long-lived refreshToken
  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );

  return { accessToken, refreshToken };
};

// ===== REGISTER =====
router.post(
  '/register',
  registerValidator,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn({ errors: errors.array() }, 'Register validation failed');
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        details: errors.array()
      });
    }

    const { name, email, password } = req.body;

    let user = await User.findOne({ email });
    if (user) {
      logger.info({ email }, 'Register: user already exists');
      return res.status(400).json({
        status: 'error',
        message: 'User already exists'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user = new User({ name, email, password: hashedPassword });
    await user.save();

    const { accessToken, refreshToken } = generateTokens(user._id);

    // ✅ PRODUCTION: Store refresh token in DB
    user.refreshTokens.push({
      token: refreshToken,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS)
    });
    await user.save();

    logger.info({ userId: user._id, email }, 'User registered successfully');

    // ✅ BACKWARD COMPATIBILITY: Also return legacy 'token' field
    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      accessToken,
      refreshToken,
      token: accessToken, // Legacy field for existing frontend
      userId: user._id
    });
  })
);

// ===== LOGIN =====
router.post(
  '/login',
  loginValidator,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn({ errors: errors.array() }, 'Login validation failed');
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      logger.info({ email }, 'Login: invalid credentials');
      return res.status(400).json({
        status: 'error',
        message: 'Invalid credentials'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      logger.warn({ userId: user._id }, 'Login: password mismatch');
      return res.status(400).json({
        status: 'error',
        message: 'Invalid credentials'
      });
    }

    const { accessToken, refreshToken } = generateTokens(user._id);

    // ✅ PRODUCTION: Store refresh token in DB
    user.refreshTokens.push({
      token: refreshToken,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS)
    });

    // ✅ PRODUCTION: Clean up expired refresh tokens
    user.refreshTokens = user.refreshTokens.filter(rt => rt.expiresAt > Date.now());

    await user.save();

    logger.info({ userId: user._id, email }, 'User logged in successfully');

    // ✅ BACKWARD COMPATIBILITY: Also return legacy 'token' field
    res.json({
      status: 'success',
      message: 'Login successful',
      accessToken,
      refreshToken,
      token: accessToken, // Legacy field for existing frontend
      userId: user._id
    });
  })
);

// ===== REFRESH TOKEN =====
router.post(
  '/refresh',
  refreshTokenValidator,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn({ errors: errors.array() }, 'Refresh token validation failed');
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        details: errors.array()
      });
    }

    const { refreshToken } = req.body;

    try {
      // ✅ Verify refreshToken signature
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

      if (decoded.type !== 'refresh') {
        logger.warn({ userId: decoded.userId }, 'Attempted refresh with non-refresh token');
        return res.status(401).json({
          status: 'error',
          message: 'Invalid token type'
        });
      }

      // ✅ Verify token exists in DB and is not expired
      const user = await User.findById(decoded.userId);
      if (!user) {
        logger.warn({ userId: decoded.userId }, 'Refresh: user not found');
        return res.status(401).json({
          status: 'error',
          message: 'User not found'
        });
      }

      const tokenExists = user.refreshTokens.some(
        rt => rt.token === refreshToken && rt.expiresAt > Date.now()
      );

      if (!tokenExists) {
        logger.warn({ userId: decoded.userId }, 'Refresh token not found or expired in DB');
        return res.status(401).json({
          status: 'error',
          message: 'Refresh token expired or revoked'
        });
      }

      // ✅ Generate new accessToken
      const newAccessToken = jwt.sign(
        { userId: user._id, type: 'access' },
        process.env.JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
      );

      logger.info({ userId: user._id }, 'Access token refreshed');

      res.json({
        status: 'success',
        accessToken: newAccessToken,
        token: newAccessToken // Legacy field
      });
    } catch (err) {
      logger.warn({ error: err.message }, 'Refresh token verification failed');
      return res.status(401).json({
        status: 'error',
        message: 'Invalid refresh token',
        details: err.message
      });
    }
  })
);

// ===== LOGOUT =====
router.post(
  '/logout',
  auth,
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    const user = await User.findById(req.userId);
    if (!user) {
      logger.warn({ userId: req.userId }, 'Logout: user not found');
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // ✅ PRODUCTION: Revoke refresh token
    if (refreshToken) {
      user.refreshTokens = user.refreshTokens.filter(rt => rt.token !== refreshToken);
    } else {
      // If no specific token, clear all refresh tokens (logout from all devices)
      user.refreshTokens = [];
    }

    // ✅ PRODUCTION: Add current token to revocation list
    user.revokedTokens.push({
      token: req.token
    });

    // ✅ PRODUCTION: Clean up old revoked tokens (older than 30 days)
    user.revokedTokens = user.revokedTokens.filter(
      rt => rt.revokedAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    );

    await user.save();

    logger.info({ userId: user._id }, 'User logged out');

    res.json({
      status: 'success',
      message: 'Logged out successfully'
    });
  })
);

module.exports = router;

