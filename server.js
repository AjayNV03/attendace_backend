const express = require('express');
const cors = require('cors');
const sequelize = require('./config/db');
require('dotenv').config();

/**
 * FIXED: Explicitly pull in associated models through your index hub file.
 * This registers your new 'UserSubjects' junction tracking table configuration 
 * before Sequelize checks schemas with the MySQL database server.
 */
const { User, Subject, Attendance, Holiday } = require('./models/index');

// Initialize the Express Application instance
const app = express();

// Global Middlewares Setup
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000', // Restricts traffic securely to your React pipeline origin
  credentials: true
}));
app.use(express.json());         // Parse incoming request bodies with JSON payloads safely

// Base Welcome Root Gateway Route Controller Handler
app.get('/', (req, res) => {
  res.send('<h1>Attendance Tracker Backend Service</h1><p>The server is running smoothly and communicating with MySQL.</p>');
});

// Fallback status health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Attendance Tracker backend service is operational.' });
});

// Bind API Route Controllers Layouts
app.use('/api/auth', require('./routes/auth'));
app.use('/api/attendance', require('./routes/attendance'));

// ✅ CRITICAL BINDING INJECTION LAYER: Exposes your master global subjects CRUD endpoints matrix
app.use('/api/subjects', require('./routes/subjects'));

// Define operational port connection constraints
const PORT = process.env.PORT || 5000;

sequelize.sync() 
  .then(() => {
    console.log('✔ MySQL Database schemas synchronized safely. Production storage layer locked.');

    // CRITICAL FIX: Start listening IMMEDIATELY so network connections don't drop or time out
    app.listen(PORT, () => {
      console.log(`🚀 Backend tracking engine running securely on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Failed to synchronize relational database tables:', err.message);
    process.exit(1); 
  });
