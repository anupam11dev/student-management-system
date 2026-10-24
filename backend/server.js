const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { connectDB, getStatus } = require('./config/database');
const { User } = require('./models');
const seedData = require('./utils/seed');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger for development
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[API ${req.method}] ${req.path}`);
  }
  next();
});

// Serve frontend static files
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/students', require('./routes/student'));
app.use('/api/courses', require('./routes/course'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/marks', require('./routes/marks'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/reports', require('./routes/report'));

// Health & System status endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    appName: 'Student Management System (SMS)',
    version: '1.0.0',
    db: getStatus(),
    timestamp: new Date().toISOString()
  });
});

// Root route redirect to login
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'login.html'));
});

// 404 handler for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint ${req.method} ${req.originalUrl} not found.`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Start server with automatic port retry on EADDRINUSE
const listenWithRetry = (portToTry) => {
  return new Promise((resolve, reject) => {
    const server = app.listen(portToTry, () => {
      console.log('\n======================================================');
      console.log(`🚀 Student Management System (SMS) Server is running!`);
      console.log(`📡 URL: http://localhost:${portToTry}`);
      console.log(`📁 Static files served from: ${frontendPath}`);
      console.log(`🗄️  Database mode: ${getStatus().mode}`);
      console.log('======================================================\n');
      resolve(server);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[Server] Port ${portToTry} is in use, trying port ${portToTry + 1}...`);
        resolve(listenWithRetry(portToTry + 1));
      } else {
        reject(err);
      }
    });
  });
};

const startServer = async () => {
  try {
    await connectDB();

    // Check if initial users exist, otherwise auto-seed
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('[Startup] No users found in database, running automatic seed...');
      await seedData();
    }

    return await listenWithRetry(PORT);
  } catch (error) {
    console.error('[Server Startup Failure]:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
