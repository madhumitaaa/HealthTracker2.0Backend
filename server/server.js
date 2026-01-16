require('dotenv').config();
console.log('GROQ KEY:', process.env.GROQ_API_KEY?.slice(0, 10));


const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const entriesRoute = require('./routes/entries');
const authRoute = require('./routes/auth');
const aiRoute = require('./routes/ai');

const app = express();

// ===== Middleware =====
app.use(cors());
app.use(express.json());

// ===== Health Check =====
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running!' });
});

// ===== Routes =====
app.use('/auth', authRoute);
app.use('/entries', entriesRoute);
app.use('/ai', aiRoute); // ✅ AI ROUTE

// ===== Error Handler =====
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
});

// ===== DB + Server =====
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () =>
      console.log(`Server running on port ${PORT}`)
    );
  })
  .catch((err) => console.error(err));
