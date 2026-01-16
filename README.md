# HealthTracker Backend

A robust and scalable backend application for health tracking and fitness management built with Node.js, Express, and MongoDB.

## 📋 Table of Contents

- [Features](#features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Configuration](#configuration)
- [API Endpoints](#api-endpoints)
- [Middleware](#middleware)
- [Database Models](#database-models)
- [Contributing](#contributing)
- [License](#license)

## ✨ Features

- User authentication and authorization
- Health entry management (logs, metrics, progress tracking)
- Secure API endpoints with JWT authentication
- MongoDB database integration
- RESTful API architecture
- Docker support for containerized deployment
- Environment-based configuration

## 🛠️ Technology Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB
- **Authentication**: JWT (JSON Web Tokens)
- **Deployment**: Docker
- **Language**: JavaScript (ES6+)

## 📁 Project Structure

```
HealthTrackerBACK/
├── server/
│   ├── Dockerfile              # Docker configuration
│   ├── server.js               # Main server file
│   ├── package.json            # Server dependencies
│   ├── middleware/
│   │   └── authmiddleware.js   # Authentication middleware
│   ├── models/
│   │   ├── Entry.js            # Health entry model
│   │   └── User.js             # User model
│   └── routes/
│       ├── ai.js               # AI-related routes
│       ├── auth.js             # Authentication routes
│       └── entries.js          # Health entry routes
├── package.json                # Root dependencies
├── ARCHITECTURE.md             # Architecture documentation
├── .gitignore                  # Git ignore rules
└── README.md                   # This file
```

## 🚀 Installation

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or cloud instance)
- npm or yarn package manager

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
   Create a `.env` file in the server directory:
   ```
   MONGODB_URI=mongodb://localhost:27017/healthtracker
   JWT_SECRET=your_jwt_secret_key
   PORT=5000
   NODE_ENV=development
   ```

4. **Start the server**
   ```bash
   npm run server
   # or
   node server/server.js
   ```

The server will start on `http://localhost:5000`

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/healthtracker` |
| `JWT_SECRET` | Secret key for JWT signing | Required |
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Environment mode | `development` |

## 📡 API Endpoints

### Authentication Routes (`/api/auth`)
- `POST /register` - Register a new user
- `POST /login` - User login
- `POST /logout` - User logout
- `GET /profile` - Get user profile (protected)

### Health Entries Routes (`/api/entries`)
- `GET /` - Get all entries for authenticated user
- `POST /` - Create a new health entry
- `GET /:id` - Get a specific entry
- `PUT /:id` - Update an entry
- `DELETE /:id` - Delete an entry

### AI Routes (`/api/ai`)
- `POST /analyze` - Analyze health data with AI
- `GET /insights` - Get AI-generated insights

## 🔐 Middleware

### Authentication Middleware
Located in `server/middleware/authmiddleware.js`
- Validates JWT tokens
- Protects routes requiring authentication
- Attaches user information to request object

## 📊 Database Models

### User Model
```javascript
- email (unique)
- password (hashed)
- firstName
- lastName
- dateOfBirth
- createdAt
- updatedAt
```

### Entry Model
```javascript
- userId (reference to User)
- entryType
- value
- unit
- timestamp
- notes
- createdAt
- updatedAt
```

## 🐳 Docker Deployment

Build and run using Docker:

```bash
cd server
docker build -t healthtracker-backend .
docker run -p 5000:5000 healthtracker-backend
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Need Help?** Check the [ARCHITECTURE.md](./ARCHITECTURE.md) file for detailed system architecture documentation.
