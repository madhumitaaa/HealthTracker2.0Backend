# HealthTracker Backend

The backend of **HealthTracker** is a robust Express.js API that handles user authentication, health entry management, and AI-driven health insights. It supports both synchronous and asynchronous AI processing with optional Redis + BullMQ integration.

---

## Table of Contents

1. [Project Overview](#project-overview)  
2. [Core Features](#core-features)  
3. [Authentication](#authentication)  
4. [Health Entry Management](#health-entry-management)  
5. [AI Health & Planning](#ai-health--planning)  
6. [Data Models](#data-models)  
7. [Validation & Security](#validation--security)  
8. [Async Job Queue Support](#async-job-queue-support)  
9. [Server Architecture](#server-architecture)  
10. [Environment Variables](#environment-variables)  
11. [Installation & Quick Start](#installation--quick-start)  
12. [Deployment](#deployment)  
13. [License](#license)  

---

## Project Overview

**HealthTracker Backend** provides:

- Secure JWT-based authentication with access and refresh tokens  
- Full CRUD operations for daily health entries  
- AI-powered features: chat, weekly report, daily routine, night review, weekly progress  
- Dashboard-ready summaries for today’s health data  
- Optional async AI processing for scalability and non-blocking operations  

---

## Core Features

- Express server with `helmet` for security headers  
- CORS configured for allowed origins  
- JSON body parsing (limit: 10MB)  
- Structured logging with `pino`  
- Health check endpoint: `GET /api/health`  
- Centralized error handling for:
  - Validation errors  
  - MongoDB errors  
  - JWT errors  
  - Generic server errors  
- MongoDB connection via `mongoose`  
- Graceful shutdown handling (SIGTERM/SIGINT)  

---

## Authentication

**Routes:** `auth.js`

| Endpoint                  | Method | Description |
|----------------------------|--------|-------------|
| `/auth/register`           | POST   | Registers a new user with profile (height, weight, age, gender, goal). Issues `accessToken` and `refreshToken`. |
| `/auth/login`              | POST   | Authenticates user and returns tokens + profile. |
| `/auth/refresh`            | POST   | Exchanges a valid `refreshToken` for a new `accessToken`. |
| `/auth/logout`             | POST   | Logs out current session or all sessions. Revokes tokens. |
| `/auth/profile`            | PUT    | Updates user profile and calculates BMI if height/weight exist. |

**Validation:**  
- Email format  
- Password strength (uppercase, lowercase, digit, 6–128 chars)  
- Name length 2–100  

**Middleware:** `authMiddleware.js` – protects routes and extracts `userId` from JWT.

---

## Health Entry Management

**Routes:** `entries.js`

| Endpoint                         | Method | Description |
|---------------------------------|--------|-------------|
| `/entries/dashboard/summary`     | GET    | Returns today’s summary: calories, sleep, steps, heart rate, mood, water, food intake. |
| `/entries`                       | GET    | Fetch latest 30 entries for authenticated user. |
| `/entries`                       | POST   | Create a new daily health entry (1 entry per user/day). |
| `/entries/:id`                   | GET    | Fetch a single entry by ID. |
| `/entries/:id`                   | PUT    | Update entry by ID. |
| `/entries/:id`                   | DELETE | Delete entry by ID. |

**Model:** `Entry.js`  
- Daily unique index per user  
- Indexed queries for performance  
- Validates numeric ranges (calories, sleep, heart rate, steps, etc.)

---

## AI Health & Planning

**Routes:** `ai.js`

| Endpoint                      | Method | Description |
|-------------------------------|--------|-------------|
| `/ai/chat`                     | POST   | AI chat interaction (rate-limited, async queue fallback). |
| `/ai/weekly-report`            | POST   | AI-generated weekly health report from last 7 entries. |
| `/ai/job-status/:jobId`        | GET    | Async AI job status (Redis required). |
| `/ai/daily-routine`            | POST   | Generates AI daily routine, stores in `MorningPlan`. |
| `/ai/night-review`             | GET    | Nightly review: compares morning plan vs today’s entry, computes completion and score. |
| `/ai/weekly-progress`          | GET    | Last 7 nightly reviews for progress analytics. |

**Models:**  
- `MorningPlan.js` – daily routine per user/date  
- `NightReview.js` – nightly reviews with metrics and AI analysis  

---

## Validation & Security

- Input validation: `validators.js`  
- Sanitization for AI messages: `sanitizer.js`  
- Centralized error handling  
- JWT access + refresh token security  

---

## Async Job Queue Support

Optional asynchronous processing:

- `queue.js` – configures BullMQ + Redis  
- `start-worker.js` – worker process for AI tasks  
- AI routes detect Redis availability; fallback to synchronous calls if unavailable  

---

## Server Architecture

```text
server/
├─ server.js             # Express app entrypoint
├─ start-worker.js       # Async AI worker
├─ Dockerfile
├─ middleware/
│  └─ authMiddleware.js
├─ models/
│  ├─ User.js
│  ├─ Entry.js
│  ├─ MorningPlan.js
│  └─ NightReview.js
├─ routes/
│  ├─ auth.js
│  ├─ entries.js
│  └─ ai.js
└─ utils/
   ├─ asyncHandler.js
   ├─ logger.js
   ├─ queue.js
   ├─ sanitizer.js
   └─ validators.js
