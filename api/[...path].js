const { app } = require('../backend/server');
const { connectDB } = require('../backend/config/database');

let databaseConnection;

module.exports = async (req, res) => {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(503).json({
        success: false,
        message: 'Authentication unavailable. Configure JWT_SECRET in the Vercel project settings.'
      });
    }

    if (!databaseConnection) {
      databaseConnection = connectDB().then((connected) => {
        if (!connected) databaseConnection = null;
        return connected;
      });
    }

    const connected = await databaseConnection;
    if (!connected) {
      return res.status(503).json({
        success: false,
        message: 'Database unavailable. Configure MONGODB_URI in the Vercel project settings.'
      });
    }

    return app(req, res);
  } catch (error) {
    console.error('[Vercel API Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error'
    });
  }
};
