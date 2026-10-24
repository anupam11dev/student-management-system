const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sms_db';
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 3000,
    });
    isConnected = true;
    console.log(`[Database] MongoDB Connected successfully: ${conn.connection.host}/${conn.connection.name}`);
    return true;
  } catch (error) {
    console.warn(`[Database] MongoDB connection to "${uri}" failed: ${error.message}`);
    console.info(`[Database] Switching to embedded local persistence engine so you can run and test SMS immediately.`);
    isConnected = false;
    return false;
  }
};

const getStatus = () => ({
  connected: isConnected,
  mode: isConnected ? 'mongodb' : 'embedded_json',
  uri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sms_db'
});

module.exports = { connectDB, getStatus };

