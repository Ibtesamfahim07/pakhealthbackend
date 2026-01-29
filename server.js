const express = require('express');
const cors = require('cors');
require('dotenv').config();
require('./config/database'); // Initialize database connection

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Import routes
const authRoutes = require('./src/routes/Authroutes.js');
const userRoutes = require('./src/routes/Userroutes');
const sugarRoutes = require('./src/routes/Sugarroutes');
const reminderRoutes = require('./src/routes/Reminderroutes');
const footRoutes = require('./src/routes/footRoutes');
const deviceRoutes = require('./src/routes/deviceRoutes');


// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sugar', sugarRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/foot-health', footRoutes);
app.use('/api/device', deviceRoutes);


// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'PakHealth API Server',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      sugar: '/api/sugar',
      reminders: '/api/reminders',
      footHealth: '/api/foot-health',
      device: '/api/device'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📍 API URL: http://localhost:${PORT}`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/api/health\n`);
});

module.exports = app;