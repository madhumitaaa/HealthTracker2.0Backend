#!/usr/bin/env node

/**
 * ✅ PRODUCTION: AI Worker Startup Script
 * Run this in a separate process to handle async AI job processing
 * 
 * Usage:
 *   npm run worker
 *   # or
 *   node start-worker.js
 */

require('dotenv').config();
const path = require('path');

// Validate required environment variables
const required = ['MONGO_URI', 'JWT_SECRET', 'GROQ_API_KEY', 'REDIS_HOST'];
const missing = required.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  console.error('Please check your .env file');
  process.exit(1);
}

// Start the worker
console.log('🚀 Starting AI Worker...');
console.log(`📡 Redis: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`);
console.log(`📊 MongoDB: ${process.env.MONGO_URI.split('@')[1] || 'local'}`);

require(path.join(__dirname, 'worker', 'aiWorker.js'));
