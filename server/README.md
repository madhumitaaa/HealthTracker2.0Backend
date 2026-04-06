# HealthTracker Backend

## 📋 Table of Contents

- [Features](#features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Server](#running-the-server)
- [Running the AI Worker](#running-the-ai-worker)
- [API Endpoints](#api-endpoints)
- [Production Features](#production-features)
- [Database Models](#database-models)
- [Contributing](#contributing)
- [License](#license)

## ✨ Features

### Core Features
- ✅ User authentication with refresh tokens (15min access, 7d refresh)
- ✅ Health entry management (logs, metrics, progress tracking)
- ✅ AI-powered health insights via Groq API
- ✅ Secure API endpoints with JWT authentication & token revocation
- ✅ MongoDB with indexes and unique constraints for performance
- ✅ RESTful API architecture with consistent response format

### Production Features
- ✅ **Security**: Helmet headers, CORS hardening, input validation & sanitization
- ✅ **Async Jobs**: BullMQ + Redis queue for async AI processing with retry logic
- ✅ **Error Handling**: Centralized error handler with structured error responses
- ✅ **Logging**: Pino structured logging with request context
- ✅ **Validation**: express-validator with custom rules for all routes
- ✅ **Database**: Compound indexes for fast queries, unique constraints to prevent duplicates
- ✅ **Health Checks**: Extended `/api/health` with MongoDB and Redis status
- ✅ **Graceful Shutdown**: Proper cleanup and connection management

## 🛠️ Technology Stack

### Core
- **Runtime**: Node.js (v14+)
- **Framework**: Express.js
- **Database**: MongoDB
- **Authentication**: JWT (JSON Web Tokens)
- **Language**: JavaScript (ES6+)

### Production Dependencies
- **Security**: Helmet, bcrypt, express-validator
- **Async Jobs**: BullMQ, Redis, axios
- **Logging**: Pino, Pino-pretty
- **Validation**: express-validator
- **Rate Limiting**: express-rate-limit

### Optional
- **Deployment**: Docker
- **Monitoring**: Sentry, Datadog (configurable)

## 📁 Project Structure

```
HealthTrackerBACK/
├── server/
│   ├── Dockerfile              # Docker configuration
│   ├── server.js               # Main server with Helmet & error handling
│   ├── start-worker.js         # AI worker process launcher
│   ├── package.json            # Dependencies
│   ├── .env.example            # Environment variables template
│   ├── middleware/
│   │   └── authmiddleware.js   # JWT validation with token revocation
│   ├── models/
│   │   ├── Entry.js            # Health entry with indexes & validation
│   │   └── User.js             # User with refresh token storage
│   ├── routes/
│   │   ├── ai.js               # AI endpoints (async + sync modes)
│   │   ├── auth.js             # Auth with refresh tokens & logout
│   │   └── entries.js          # Entry CRUD with validation
│   ├── utils/
│   │   ├── asyncHandler.js     # Async error wrapper
│   │   ├── logger.js           # Pino structured logging
│   │   ├── validators.js       # Reusable validation rules
│   │   ├── sanitizer.js        # Input sanitization
│   │   └── queue.js            # BullMQ queue setup
│   └── worker/
│       └── aiWorker.js         # AI job worker with retry logic
├── ARCHITECTURE.md             # Detailed architecture documentation
├── .gitignore                  # Git ignore rules
└── README.md                   # This file
```

## 🚀 Installation

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or cloud instance)
- npm or yarn package manager
- Redis (optional, for async job queue)

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd HealthTrackerBACK
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd server && npm install
   ```

3. **Configure environment variables**
   ```bash
   cp server/.env.example server/.env
   # Edit server/.env with your configuration
   ```

   **Required variables**:
   - `MONGO_URI`: MongoDB connection string
   - `JWT_SECRET`: Secret key for JWT (min 32 characters)
   - `GROQ_API_KEY`: API key from https://console.groq.com/keys

   **Optional variables** (for async jobs):
   - `REDIS_HOST`, `REDIS_PORT`: Redis connection details
   - `ENABLE_ASYNC_JOBS`: Set to `true` to enable BullMQ queue

4. **Verify installation**
   ```bash
   npm run dev
   # Server should start on http://localhost:5000
   ```

## ⚙️ Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MONGO_URI` | ✅ | - | MongoDB connection string |
| `JWT_SECRET` | ✅ | - | Secret for JWT signing (min 32 chars) |
| `GROQ_API_KEY` | ✅ | - | Groq API key for AI features |
| `PORT` | ❌ | `5000` | Server port |
| `NODE_ENV` | ❌ | `development` | Environment: `development` or `production` |
| `ALLOWED_ORIGINS` | ❌ | `localhost:3000` | Comma-separated allowed CORS origins |
| `REDIS_HOST` | ❌ | `localhost` | Redis server hostname |
| `REDIS_PORT` | ❌ | `6379` | Redis server port |
| `REDIS_PASSWORD` | ❌ | - | Redis password (if required) |
| `ENABLE_ASYNC_JOBS` | ❌ | `false` | Enable BullMQ async jobs |
| `WORKER_CONCURRENCY` | ❌ | `5` | Max concurrent AI jobs |

## 🚀 Running the Server

### Development Mode
```bash
cd server
npm run dev
# or
NODE_ENV=development node server.js
```

Server starts on `http://localhost:5000`

### Production Mode
```bash
cd server
NODE_ENV=production node server.js
```

### With Docker
```bash
cd server
docker build -t healthtracker-backend .
docker run -p 5000:5000 --env-file .env healthtracker-backend
```

## 🤖 Running the AI Worker

The AI worker processes async jobs from the queue. Required only if `ENABLE_ASYNC_JOBS=true`.

### Prerequisites
- Redis running and accessible
- Environment variables configured (same `.env` file as server)

### Start Worker
```bash
cd server
npm run worker
# or
node start-worker.js
```

**Output example**:
```
🚀 Starting AI Worker...
📡 Redis: localhost:6379
📊 MongoDB: healthtracker
Worker configuration {
  concurrency: 5,
  redis: 'localhost:6379'
}
AI Worker started successfully
```

### Production Setup (with PM2)
```bash
# Install PM2
npm install -g pm2

# Start server
pm2 start server/server.js --name "healthtracker-api"

# Start worker in separate process
pm2 start server/start-worker.js --name "healthtracker-worker"

# Monitor
pm2 monit

# View logs
pm2 logs healthtracker-api
pm2 logs healthtracker-worker

# Save process list
pm2 save
pm2 startup
```

### Async Job Flow (when enabled)

```
1. Frontend sends POST /ai/chat
   ↓
2. Server validates input → enqueues job → returns jobId
   ↓
3. Frontend polls GET /ai/job-status/{jobId}
   ↓
4. Worker processes job from queue → calls Groq API
   ↓
5. Result stored in job state (accessible via status endpoint)
   ↓
6. Frontend retrieves result when ready (status: completed)
```

**Fallback Mode**: If Redis unavailable, automatically switches to synchronous processing (no job queue).

## 📡 API Endpoints

### Authentication Routes (`/auth`)

#### POST `/register`
Register a new user.
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123"
}
```
**Response**:
```json
{
  "status": "success",
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "token": "eyJhbGc...",
  "userId": "507f1f77bcf86cd799439011"
}
```

#### POST `/login`
User login.
```json
{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```
**Response**: Same as register

#### POST `/refresh`
Get a new accessToken using refreshToken.
```json
{
  "refreshToken": "eyJhbGc..."
}
```
**Response**:
```json
{
  "status": "success",
  "accessToken": "eyJhbGc..."
}
```

#### POST `/logout`
Revoke refresh token and logout.
```json
{
  "refreshToken": "eyJhbGc..."
}
```

### Health Entries Routes (`/entries`)

#### GET `/`
Get last 30 entries for authenticated user.
**Headers**: `Authorization: Bearer {accessToken}`
**Response**:
```json
{
  "status": "success",
  "count": 5,
  "data": [...]
}
```

#### GET `/dashboard/summary`
Get today's health summary.
**Response**:
```json
{
  "status": "success",
  "data": {
    "calories": 2000,
    "sleep": 8,
    "workouts": 1,
    "mood": "good"
  }
}
```

#### POST `/`
Create or update entry for a day.
```json
{
  "date": "2024-01-16T00:00:00Z",
  "calories": 2000,
  "sleep": 8,
  "workouts": true,
  "foodIntake": [
    {
      "meal": "breakfast",
      "food": "Eggs and toast",
      "calories": 400
    }
  ]
}
```

#### PUT `/:id`
Update an entry by ID.

#### DELETE `/:id`
Delete an entry by ID.

### AI Routes (`/ai`)

#### POST `/chat`
Get health advice from AI.
```json
{
  "message": "What should I eat for better energy?"
}
```
**Response (Async mode)**:
```json
{
  "status": "success",
  "jobId": "chat-123456-1234567890",
  "mode": "async",
  "checkStatusUrl": "/ai/job-status/chat-123456-1234567890"
}
```
**Response (Sync fallback)**:
```json
{
  "status": "success",
  "reply": "Here are some energy-boosting foods...",
  "mode": "sync"
}
```

#### POST `/weekly-report`
Get AI-generated weekly health report.
**Response**: Same as `/chat`

#### GET `/job-status/:jobId`
Get async job status and result.
**Response**:
```json
{
  "status": "success",
  "job": {
    "id": "chat-123456-1234567890",
    "status": "completed",
    "progress": 100,
    "result": {
      "success": true,
      "reply": "..."
    }
  }
}
```

### Health Check

#### GET `/api/health`
Server and service status.
**Response**:
```json
{
  "status": "success",
  "timestamp": "2024-01-16T10:00:00.000Z",
  "uptime": 3600,
  "services": {
    "database": "connected",
    "redis": "connected"
  },
  "environment": "production"
}
```

## 🔐 Security Features

### Authentication & Authorization
- ✅ **Refresh Token Rotation**: 15-minute access tokens with 7-day refresh tokens
- ✅ **Token Revocation**: Logout invalidates tokens immediately
- ✅ **Password Hashing**: bcrypt with salt rounds
- ✅ **JWT Validation**: Signature and expiration checks

### Input Validation & Sanitization
- ✅ **express-validator**: Type, format, and range validation on all routes
- ✅ **HTML/JS Stripping**: Sanitizes user input to prevent XSS
- ✅ **Max Length Enforcement**: Prevents buffer overflow attacks
- ✅ **Schema Validation**: Mongoose schema with min/max/enum constraints

### HTTP Security
- ✅ **Helmet**: Sets security headers (CSP, X-Frame-Options, etc.)
- ✅ **CORS**: Hardened CORS with allowed origins whitelist
- ✅ **Rate Limiting**: Express-rate-limit to prevent brute force attacks
- ✅ **Payload Limit**: 10MB max JSON payload size

### Database Security
- ✅ **Compound Indexes**: `(user, date)` unique constraint prevents duplicate entries
- ✅ **Query Optimization**: Fast lookups with indexed `user` and `date` fields
- ✅ **Prepared Statements**: Mongoose ODM prevents injection attacks

## 🔧 Production Features

### Error Handling
- ✅ **Centralized Error Handler**: All errors follow consistent JSON format
- ✅ **Async Error Wrapper**: Automatic try-catch for route handlers
- ✅ **Detailed Logging**: Error stack traces in development, sanitized in production
- ✅ **Error IDs**: Unique ID per error for tracking and debugging

### Logging & Observability
- ✅ **Structured Logging**: Pino JSON logs with request context
- ✅ **Log Levels**: DEBUG, INFO, WARN, ERROR configured per environment
- ✅ **Colored Output**: Pretty-printed logs in development
- ✅ **Request Tracking**: Endpoint, method, userId logged per request

### Async Job Processing
- ✅ **BullMQ Queue**: Offload AI processing to separate worker process
- ✅ **Exponential Backoff**: Automatic retry with increasing delays
- ✅ **Job Persistence**: Failed jobs stored for manual review
- ✅ **Concurrency Control**: Limit simultaneous jobs (default: 5)

### Database Performance
- ✅ **Index on Date**: Fast `last 30 entries` queries (O(log n))
- ✅ **Compound Index**: Prevent duplicate daily entries
- ✅ **Connection Pooling**: Efficient MongoDB connection management
- ✅ **Field Validation**: Mongoose schema enforces data integrity

## 📊 Database Models

### User Model
```javascript
{
  name: String (required, 2-100 chars),
  email: String (required, unique),
  password: String (hashed with bcrypt),
  refreshTokens: [{
    token: String,
    expiresAt: Date
  }],
  revokedTokens: [{
    token: String,
    revokedAt: Date
  }],
  createdAt: Date,
  updatedAt: Date
}
```

### Entry Model
```javascript
{
  user: ObjectId (required, indexed),
  date: Date (required, indexed, part of unique constraint),
  calories: Number (0-10000),
  sleep: Number (0-24 hours),
  workouts: Boolean,
  foodIntake: [{
    meal: String (breakfast|lunch|dinner|snack),
    food: String (max 200 chars),
    calories: Number (0-5000)
  }],
  heartRate: Number,
  steps: Number,
  symptoms: [String],
  mood: String (enum),
  waterIntake: Number,
  createdAt: Date,
  updatedAt: Date
}
```

## 🐳 Docker Deployment

Build and run using Docker:

```bash
cd server
docker build -t healthtracker-backend .
docker run -p 5000:5000 --env-file .env healthtracker-backend
```

With Docker Compose:
```yaml
version: '3.8'
services:
  api:
    build: ./server
    ports:
      - "5000:5000"
    environment:
      - MONGO_URI=mongodb://mongo:27017/healthtracker
      - REDIS_HOST=redis
    depends_on:
      - mongo
      - redis

  worker:
    build: ./server
    command: npm run worker
    environment:
      - MONGO_URI=mongodb://mongo:27017/healthtracker
      - REDIS_HOST=redis
    depends_on:
      - mongo
      - redis

  mongo:
    image: mongo:5
    volumes:
      - mongo_data:/data/db

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  mongo_data:
  redis_data:
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
