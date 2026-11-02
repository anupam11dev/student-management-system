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
    console.warn(`[Database] MongoDB connection failed: ${error.message}`);
    console.info('[Database] Standalone mode can use embedded local persistence when MongoDB is unavailable.');
    isConnected = false;
    return false;
  }
};

const getStatus = () => ({
  connected: isConnected,
  mode: isConnected ? 'mongodb' : 'embedded_json'
});

module.exports = { connectDB, getStatus };
