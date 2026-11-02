const { app } = require('../backend/server');
const { connectDB } = require('../backend/config/database');

let databaseConnection;

module.exports = async (req, res) => {
  try {
    const requestUrl = new URL(req.url, 'http://localhost');
    const forwardedPath = requestUrl.searchParams.get('__vercel_path');

    if (forwardedPath !== null) {
      requestUrl.searchParams.delete('__vercel_path');
      const routePath = forwardedPath.replace(/^\/+/, '');
      req.url = `/api/${routePath}${requestUrl.search}`;
    }

    const missingConfig = [];
    if (!process.env.JWT_SECRET) missingConfig.push('JWT_SECRET');
    if (!process.env.MONGODB_URI) missingConfig.push('MONGODB_URI');
    if (missingConfig.length > 0) {
      return res.status(503).json({
        success: false,
        message: `Missing Vercel environment variable${missingConfig.length > 1 ? 's' : ''}: ${missingConfig.join(', ')}.`
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
        message: 'Database unavailable. Check MONGODB_URI and the MongoDB Atlas network access settings.'
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
