const jwt = require('jsonwebtoken');
const { User, Course } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'sms_super_secret_jwt_key_2026_btech_project';

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : req.query.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No authentication token provided.'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || user.status === 'inactive') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token or inactive account.'
      });
    }

    req.user = {
      _id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      linkedStudentId: user.linkedStudentId ? String(user.linkedStudentId._id || user.linkedStudentId) : null,
      department: user.department
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Session expired. Please log in again.'
      });
    }
    return res.status(403).json({
      success: false,
      message: 'Invalid or malformed authentication token.'
    });
  }
};

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden. Role '${req.user.role}' is not authorized to access this resource. Required roles: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
};

const authorizeCourseTeacher = async (req, res, next) => {
  try {
    if (req.user.role === 'admin') {
      return next(); // Admin has universal course management access
    }

    if (req.user.role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: 'Only teachers and administrators can perform this action.'
      });
    }

    const courseId = req.body.courseId || req.params.courseId || req.query.courseId;
    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: 'Course ID is required.'
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found.'
      });
    }

    const assignedTeacherId = course.teacherId ? String(course.teacherId._id || course.teacherId) : null;
    if (assignedTeacherId && assignedTeacherId !== req.user._id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You are not the assigned instructor for this course.'
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  authenticateToken,
  requireRole,
  authorizeCourseTeacher
};

