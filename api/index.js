const { app } = require('../backend/server');
const { connectDB } = require('../backend/config/database');

// Default fallback configuration for seamless Vercel / serverless deployments
if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = 'mongodb+srv://anupamguptaji123_db_user:Cudkr5aiCb9bmgpx@cluster0.esgoset.mongodb.net/sms_db?retryWrites=true&w=majority';
}

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'sms_super_secret_jwt_key_2026_btech_project_prod';
}

let databaseConnection = null;

module.exports = async (req, res) => {
  try {
    const requestUrl = new URL(req.url, 'http://localhost');
    const forwardedPath = requestUrl.searchParams.get('__vercel_path');

    if (forwardedPath !== null) {
      requestUrl.searchParams.delete('__vercel_path');
      const routePath = forwardedPath.replace(/^\/+/, '');
      req.url = `/api/${routePath}${requestUrl.search}`;
    }

    if (!databaseConnection) {
      databaseConnection = connectDB().then((connected) => {
        if (!connected) databaseConnection = null;
        return connected;
      }).catch((err) => {
        console.warn('[Vercel DB Connection Warn]:', err.message);
        databaseConnection = null;
        return false;
      });
    }

    await databaseConnection;

    return app(req, res);
  } catch (error) {
    console.error('[Vercel API Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error: ' + error.message
    });
  }
};
